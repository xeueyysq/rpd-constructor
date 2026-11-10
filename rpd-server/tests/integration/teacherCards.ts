// Host-only E2E driver: реальные production-модули и PostgreSQL 5433.
// Подменяется только внешний GetDisciplinesByPlan; HTTP нашего приложения не подменяется.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { mock } from "node:test";
import axios from "axios";
import bcrypt from "bcryptjs";
import { pool } from "../../config/db.ts";
import { exchange1C } from "../../app/modules/1cExchange.ts";
import { preview1cSync } from "../../app/modules/complectSync.ts";
import { teacherPerson, fullnameText } from "../../app/modules/teacherNames.ts";
import AuthService from "../../app/services/Auth.ts";
import TokenService from "../../app/services/Token.ts";
import RefreshSessionRepository from "../../app/repositories/RefreshSession.ts";
import { Unauthorized } from "../../app/utils/Errors.ts";
import type { UserRow } from "../../app/types/db.ts";
import type { UserClaims } from "../../app/types/express.ts";

type Fixture = { login: string; role: number; active: boolean; fullname: { surname: string; name: string; patronymic: string } };
type Command = { operation: string; source?: unknown[]; profile?: string; complectId?: number;
  actorName?: string; names?: string[]; complectIds?: number[]; fixtures?: Fixture[]; cardId?: number; fixturePassword?: string };
const command = JSON.parse(readFileSync(0, "utf8")) as Command;
assert.equal(process.env.DB_PORT, "5433", "Driver разрешён только на синтетической БД 5433");
assert.ok(["localhost", "127.0.0.1"].includes(process.env.DB_HOST ?? "localhost"));
// Никаких значений учётных данных, SQL parameters или полных user rows в stdout.
console.log = () => {};
console.warn = () => {};
console.error = () => {};
mock.method(axios, "post", async (url: string) => {
  assert.ok(url.endsWith("/GetDisciplinesByPlan"), "Подменяется только внешняя 1С");
  return { data: command.source ?? [] };
});

async function actor(): Promise<UserClaims> {
  const { rows } = await pool.query<{ id: number; role: number; name: string }>(
    "SELECT id, role, name FROM users WHERE name=$1", [command.actorName ?? "admin"]);
  assert.equal(rows.length, 1);
  return { id: rows[0].id, role: rows[0].role, userName: rows[0].name };
}
const apiData = (profile = command.profile ?? "Карточки 1С synthetic") => ({ faculty: "Синтетический импорт карточек",
  year: 2098, educationForm: "Очная", educationLevel: "Бакалавриат", profile, direction: "09.03.01 synthetic" });

async function unchangedAfter(before: UserRow[]) {
  const { rows: after } = await pool.query<UserRow>("SELECT * FROM users WHERE id=ANY($1::int[]) ORDER BY id", [before.map((user) => user.id)]);
  assert.equal(JSON.stringify(before) === JSON.stringify(after), true,
    "Импорт сохраняет все поля существующих users, включая credentials, роли, активность и ФИО");
}

async function state() {
  const keys = new Set((command.names ?? []).flatMap((name) => teacherPerson(name)?.key ?? []));
  const { rows } = await pool.query<UserRow>("SELECT * FROM users ORDER BY id");
  const users = rows.filter((user) => keys.has(teacherPerson(typeof user.fullname === "string"
    ? user.fullname : fullnameText(user.fullname))?.key ?? "")).map((user) => ({ id: user.id, name: user.name,
    role: user.role, fullname: user.fullname, is_active: user.is_active,
    has_credentials: Boolean(user.name && user.password) }));
  const { rows: links } = await pool.query("SELECT label_key, user_id FROM teacher_source_cards WHERE label_key=ANY($1::text[]) ORDER BY label_key", [[...keys]]);
  const ids = command.complectIds ?? [];
  const { rows: exchange } = await pool.query("SELECT * FROM rpd_1c_exchange WHERE id_rpd_complect=ANY($1::int[]) ORDER BY id", [ids]);
  const { rows: participants } = await pool.query(`SELECT tt.* FROM teacher_templates tt JOIN rpd_profile_templates p ON p.id=tt.template_id
    WHERE p.id_rpd_complect=ANY($1::int[]) ORDER BY tt.id`, [ids]);
  const { rows: syncLog } = await pool.query("SELECT * FROM complect_sync_log WHERE complect_id=ANY($1::int[]) ORDER BY id", [ids]);
  const { rows: changes } = await pool.query(`SELECT t.* FROM template_field_changes t JOIN complect_sync_log l ON l.id=t.sync_log_id
    WHERE l.complect_id=ANY($1::int[]) ORDER BY t.id`, [ids]);
  const { rows: complects } = await pool.query("SELECT * FROM rpd_complects WHERE id=ANY($1::int[]) ORDER BY id", [ids]);
  const { rows: templates } = await pool.query("SELECT * FROM rpd_profile_templates WHERE id_rpd_complect=ANY($1::int[]) ORDER BY id", [ids]);
  const { rows: statuses } = await pool.query(`SELECT t.* FROM template_status t LEFT JOIN rpd_profile_templates p ON p.id=t.id_profile_template
    LEFT JOIN rpd_1c_exchange e ON e.id=t.id_1c_template WHERE p.id_rpd_complect=ANY($1::int[]) OR e.id_rpd_complect=ANY($1::int[]) ORDER BY t.id`, [ids]);
  const vacancyCardCount = rows.filter((user) => /^вакансия(?:\s|$)/iu.test(fullnameText(user.fullname))).length;
  return { users, links, exchange, participants, syncLog, changes, complects, templates, statuses, vacancyCardCount };
}

async function run() {
  if (command.operation === "state") return state();
  if (command.operation === "create") {
    const hashedPassword = await bcrypt.hash(command.fixturePassword ?? randomUUID(), 4);
    for (const fixture of command.fixtures ?? []) {
      await pool.query("INSERT INTO users (name,password,role,fullname,is_active) VALUES ($1,$2,$3,$4,$5)",
        [fixture.login, hashedPassword, fixture.role, fixture.fullname, fixture.active]);
    }
    const { rows: before } = await pool.query<UserRow>("SELECT * FROM users ORDER BY id");
    const current = await actor();
    const id = await exchange1C(apiData(), { actor: current });
    assert.equal(await exchange1C(apiData(), { actor: current }), id);
    await unchangedAfter(before);
    return { id, actorId: current.id };
  }
  if (command.operation === "repeat") {
    const { rows: before } = await pool.query<UserRow>("SELECT * FROM users ORDER BY id");
    const id = await exchange1C(apiData(), { actor: await actor() });
    await unchangedAfter(before);
    return { id };
  }
  if (command.operation === "concurrency") {
    const current = await actor();
    const ids = await Promise.all(["Карточки concurrency A", "Карточки concurrency B"]
      .map((profile) => exchange1C(apiData(profile), { actor: current })));
    return { ids };
  }
  if (command.operation === "preview" || command.operation === "expiredPreview") {
    if (command.operation === "expiredPreview") mock.timers.enable({ apis: ["Date"], now: Date.now() - 16 * 60 * 1000 });
    return preview1cSync(command.complectId, await actor());
  }
  if (command.operation === "noRefresh") {
    const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id=$1", [command.cardId]);
    assert.equal(rows[0].name, null);
    assert.equal(rows[0].password, null);
    const sid = randomUUID();
    const fingerprint = { hash: "synthetic-card-fingerprint", components: {} };
    const refreshToken = await TokenService.generateRefreshToken({ id: rows[0].id, userName: "synthetic-card", role: 2, sid });
    await RefreshSessionRepository.createRefreshSession({ id: rows[0].id, sid, tokenHash: TokenService.hashRefreshToken(refreshToken),
      fingerprint, expiresAt: new Date(Date.now() + 60_000) });
    try {
      await assert.rejects(AuthService.refresh({ fingerprint, currentRefreshToken: refreshToken }), Unauthorized);
    } finally { await RefreshSessionRepository.deleteByUserIds([rows[0].id]); }
    return { refreshDenied: true };
  }
  throw new Error("Неизвестная операция driver");
}

try { process.stdout.write(JSON.stringify(await run())); }
catch (error) {
  // Не сериализуем DB errors с SQL/параметрами или auth-объекты.
  process.stderr.write(error instanceof Error ? error.message : "Ошибка интеграционной проверки");
  process.exitCode = 1;
} finally { mock.restoreAll(); mock.timers.reset(); await pool.end(); }
