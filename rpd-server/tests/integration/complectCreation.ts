// Host-only E2E: настоящий HTTP listener, production router/JWT и PostgreSQL 5433.
// Подменяется только внешняя 1С. Общие users не меняются, teachers всегда пуст.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mock } from "node:test";
import express, { type ErrorRequestHandler } from "express";
import axios from "axios";
import type { PoolClient } from "pg";
import { pool } from "../../config/db.ts";
import router from "../../app/routes/routes.ts";
import TokenService from "../../app/services/Token.ts";
import { USER_ROLES } from "../../app/models/constants.ts";
import { ErrorUtils } from "../../app/utils/Errors.ts";
import type { UserClaims } from "../../app/types/express.ts";

assert.equal(process.env.DB_PORT, "5433", "Driver разрешён только на синтетической БД 5433");
assert.ok(["localhost", "127.0.0.1"].includes(process.env.DB_HOST ?? "localhost"));
console.log = () => {};
console.warn = () => {};
console.error = () => {};

const faculty = `Создание synthetic ${randomUUID()}`;
const criteria = (profile: string) => ({ faculty, year: "2097", formEducation: "Очная",
  levelEducation: "Бакалавриат", profile, directionOfStudy: "09.03.01 synthetic" });
type Criteria = ReturnType<typeof criteria>;
const raw = (discipline = "Синтетическая дисциплина") => ({ discipline, division: "Синтетическая кафедра",
  semester: 1, record_type: "1.О", teachers: [], study_load: { "Лекции": 36 }, control_load: {} });
let source = [raw()];
let externalCalls = 0;
mock.method(axios, "post", async (url: string) => {
  assert.ok(url.endsWith("/GetDisciplinesByPlan"), "Подменяется только внешний GetDisciplinesByPlan");
  externalCalls++;
  return { data: source };
});

const app = express();
app.use(express.json());
app.use("/api", router);
app.use(((error, _req, res, next) => { void next; ErrorUtils.catchError(res, error); }) as ErrorRequestHandler);
const server = createServer(app);
let baseUrl: string;
const tokens = new Map<string, string>();

async function request(path: string, actor: UserClaims | undefined, body: unknown, method = "POST") {
  const token = actor ? tokens.get(actor.userName) : undefined;
  const response = await fetch(`${baseUrl}/api/${path}`, { method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  return { status: response.status, body: await response.json() as unknown };
}
const create = (data: Criteria, actor?: UserClaims) => request("create_rpd_complect", actor, { data });

async function keyRows(data: Criteria) {
  const { rows } = await pool.query<{ id: number }>(`SELECT id FROM rpd_complects
    WHERE faculty=$1 AND year=$2 AND education_form=$3 AND education_level=$4 AND profile=$5 AND direction=$6`,
  [data.faculty, data.year, data.formEducation, data.levelEducation, data.profile, data.directionOfStudy]);
  return rows;
}

async function snapshot(id: number) {
  const queries = {
    complects: "SELECT * FROM rpd_complects WHERE id=$1 ORDER BY id",
    owners: "SELECT * FROM user_complect WHERE complect_id=$1 ORDER BY user_id",
    exchange: "SELECT * FROM rpd_1c_exchange WHERE id_rpd_complect=$1 ORDER BY id",
    profiles: "SELECT * FROM rpd_profile_templates WHERE id_rpd_complect=$1 ORDER BY id",
    statuses: `SELECT ts.* FROM template_status ts LEFT JOIN rpd_1c_exchange e ON e.id=ts.id_1c_template
      LEFT JOIN rpd_profile_templates p ON p.id=ts.id_profile_template
      WHERE e.id_rpd_complect=$1 OR p.id_rpd_complect=$1 ORDER BY ts.id`,
    participants: `SELECT tt.* FROM teacher_templates tt JOIN rpd_profile_templates p ON p.id=tt.template_id
      WHERE p.id_rpd_complect=$1 ORDER BY tt.id`,
    syncLog: "SELECT * FROM complect_sync_log WHERE complect_id=$1 ORDER BY id",
    changes: `SELECT c.* FROM template_field_changes c JOIN complect_sync_log l ON l.id=c.sync_log_id
      WHERE l.complect_id=$1 ORDER BY c.id`,
  };
  const result: Record<keyof typeof queries, Record<string, unknown>[]> = {} as Record<keyof typeof queries, Record<string, unknown>[]>;
  for (const [name, sql] of Object.entries(queries)) result[name as keyof typeof queries] = (await pool.query(sql, [id])).rows;
  return result;
}

function assertInitialized(state: Awaited<ReturnType<typeof snapshot>>, creatorId: number) {
  assert.equal(state.complects.length, 1);
  assert.deepEqual(state.owners.map((row) => row.user_id), [creatorId]);
  assert.equal(state.exchange.length, 1);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].disciplins_name, "Синтетическая дисциплина");
  assert.deepEqual(state.profiles[0].study_load, { "Лекции": 36 });
  assert.deepEqual(state.statuses.map((row) => [row.id_1c_template, row.id_profile_template, row.current_status]),
    [[state.exchange[0].id, state.profiles[0].id, "created"]]);
  assert.deepEqual(state.participants, []);
}

async function seedPreservedContent(id: number, teacher: UserClaims) {
  const state = await snapshot(id);
  const profileId = state.profiles[0].id;
  await pool.query("UPDATE rpd_profile_templates SET goals=$1,content=$2::jsonb WHERE id=$3",
    ["<p>Сохранённый авторский текст</p>", JSON.stringify([{ theme: "Авторская тема" }]), profileId]);
  await pool.query("UPDATE template_status SET current_status='ready',history=history||$1::jsonb WHERE id_profile_template=$2",
    [JSON.stringify([{ status: "ready", date: "2026-01-01T00:00:00Z", user: "Система" }]), profileId]);
  await pool.query("INSERT INTO teacher_templates(user_id,template_id,state) VALUES($1,$2,'done')", [teacher.id, profileId]);
  const { rows } = await pool.query<{ id: number }>("INSERT INTO complect_sync_log(complect_id,source) VALUES($1,'manual') RETURNING id", [id]);
  await pool.query(`INSERT INTO template_field_changes(sync_log_id,id_1c_exchange,id_profile_template,field_key,old_value,new_value)
    VALUES($1,$2,$3,'goals',$4::jsonb,$5::jsonb)`, [rows[0].id, state.exchange[0].id, profileId, '"Прежний текст"', '"Новый текст"']);
}

// Завершение ожидания определяется блокировкой PostgreSQL, а не задержкой по таймеру.
async function waitForBlocker(pid: number, finished: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    assert.equal(finished(), false, "HTTP-create должен ждать транзакцию с тем же комплектом");
    const { rows } = await pool.query<{ blocked: boolean }>(`SELECT EXISTS(
      SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND $1::int=ANY(pg_blocking_pids(pid))
    ) AS blocked`, [pid]);
    if (rows[0].blocked) return;
  }
  assert.fail("Не подтверждено ожидание HTTP-create через pg_blocking_pids");
}

async function withBlockedCreate(blocker: PoolClient, data: Criteria, actor: UserClaims, finish: "COMMIT" | "ROLLBACK") {
  const { rows } = await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
  let finished = false;
  const pending = create(data, actor).finally(() => { finished = true; });
  // Подписываемся сразу; ошибка fetch всё равно будет выброшена при await pending.
  void pending.catch(() => {});
  try {
    await waitForBlocker(rows[0].pid, () => finished);
    await blocker.query(finish);
    return await pending;
  } finally {
    await blocker.query("ROLLBACK");
    await pending.catch(() => {});
  }
}

async function insertRace(owner: UserClaims, contender: UserClaims, finish: "COMMIT" | "ROLLBACK") {
  const data = criteria(`Гонка вставки ${finish}`);
  const blocker = await pool.connect();
  try {
    await blocker.query("BEGIN");
    const { rows } = await blocker.query<{ id: number }>(`INSERT INTO rpd_complects
      (faculty,year,education_form,education_level,profile,direction) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [data.faculty, data.year, data.formEducation, data.levelEducation, data.profile, data.directionOfStudy]);
    await blocker.query("INSERT INTO user_complect(user_id,complect_id) VALUES($1,$2)", [owner.id, rows[0].id]);
    const response = await withBlockedCreate(blocker, data, contender, finish);
    const persisted = await keyRows(data);
    assert.equal(persisted.length, 1);
    const state = await snapshot(persisted[0].id);
    if (finish === "COMMIT") {
      assert.equal(response.status, 403);
      assert.equal(persisted[0].id, rows[0].id);
      assert.deepEqual(state.owners.map((row) => row.user_id), [owner.id]);
      assert.deepEqual(state.exchange, []);
      assert.deepEqual(state.profiles, []);
      assert.deepEqual(state.statuses, []);
    } else {
      assert.equal(response.status, 200);
      assert.equal(response.body, persisted[0].id);
      assertInitialized(state, contender.id);
    }
  } finally { await blocker.query("ROLLBACK"); blocker.release(); }
}

async function run() {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
  const names = ["rop", "rop2", "owner-third-rop", "field-reopen-rop", "admin", "teacher"];
  const actors: UserClaims[] = [];
  for (const name of names) {
    const { rows } = await pool.query<{ id: number; role: number; is_active: boolean }>("SELECT id,role,is_active FROM users WHERE name=$1", [name]);
    assert.equal(rows.length, 1, `Нужен seeded actor ${name}`);
    assert.equal(rows[0].is_active, true);
    assert.equal(rows[0].role, name === "admin" ? USER_ROLES.ADMIN : name === "teacher" ? USER_ROLES.TEACHER : USER_ROLES.ROP);
    const actor = { id: rows[0].id, role: rows[0].role, userName: name };
    actors.push(actor);
    tokens.set(name, await TokenService.generateAccessToken(actor));
  }
  const [rop, second, third, foreign, admin, teacher] = actors;
  const data = criteria("Новое создание РОП");
  assert.equal((await create(data)).status, 401);
  assert.equal((await create(data, teacher)).status, 403);
  assert.equal(externalCalls, 0);
  assert.deepEqual(await keyRows(data), []);

  const created = await create(data, rop);
  assert.equal(created.status, 200);
  assert.equal(typeof created.body, "number");
  const id = created.body as number;
  assert.deepEqual(await keyRows(data), [{ id }]);
  assertInitialized(await snapshot(id), rop.id);
  const adminData = criteria("Новое создание ADMIN");
  const adminCreated = await create(adminData, admin);
  assert.equal(adminCreated.status, 200);
  assertInitialized(await snapshot(adminCreated.body as number), admin.id);

  await seedPreservedContent(id, teacher);
  const all = [rop.id, second.id, third.id].sort((a, b) => a - b);
  const owners = (userIds: number[], baseUserIds: number[]) => request(`complects/${id}/owners`, admin, { userIds, baseUserIds }, "PUT");
  assert.equal((await owners(all, [rop.id])).status, 200);
  let before = await snapshot(id);
  assert.deepEqual(before.owners.map((row) => row.user_id), all);
  for (const actor of [rop, second, third, admin]) {
    assert.deepEqual(await create(data, actor), { status: 200, body: id });
    assert.deepEqual(await snapshot(id), before, "Повтор сохраняет точный полный состав и все данные комплекта");
  }
  source = [raw(), raw("Запрещённая новая дисциплина")];
  assert.equal((await create(data, foreign)).status, 403);
  assert.deepEqual(await snapshot(id), before);
  source = [raw()];
  assert.equal((await owners([], all)).status, 200);
  before = await snapshot(id);
  assert.deepEqual(before.owners, []);
  assert.equal((await create(data, rop)).status, 403);
  assert.deepEqual(await snapshot(id), before);
  assert.deepEqual(await create(data, admin), { status: 200, body: id });
  assert.deepEqual(await snapshot(id), before, "ADMIN не назначает себя существующему ownerless-комплекту");

  // Ошибка второй дисциплины должна откатить уже записанные комплект, owner, первую РПД и статус.
  const invalid = criteria("Атомарный откат импорта");
  source = [raw(), { ...raw("Ошибка PostgreSQL"), semester: 2147483648 }];
  const rolledBack = await create(invalid, rop);
  assert.equal(rolledBack.status, 500);
  assert.equal((rolledBack.body as { code?: string }).code, "22003", "Откат вызван выходом semester за диапазон INTEGER PostgreSQL");
  assert.deepEqual(await keyRows(invalid), []);
  source = [raw()];
  await insertRace(rop, second, "COMMIT");
  await insertRace(rop, second, "ROLLBACK");

  // Снятие последнего владельца под той же блокировкой комплекта, что использует API owners.
  assert.equal((await owners([rop.id], [])).status, 200);
  const blocker = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [id]);
    await blocker.query("DELETE FROM user_complect WHERE complect_id=$1", [id]);
    assert.equal((await withBlockedCreate(blocker, data, rop, "COMMIT")).status, 403);
    assert.deepEqual(await snapshot(id), before);
  } finally { await blocker.query("ROLLBACK"); blocker.release(); }
  return { completed: true };
}

try { process.stdout.write(JSON.stringify(await run())); }
catch (error) {
  process.stderr.write(error instanceof assert.AssertionError ? error.message : "Ошибка HTTP/PG проверки создания комплектов");
  process.exitCode = 1;
} finally {
  if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.query("DELETE FROM rpd_complects WHERE faculty=$1", [faculty]);
  mock.restoreAll();
  await pool.end();
}
