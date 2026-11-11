// E2E driver: production create/preview and PostgreSQL; only the external 1C call is replaced.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "node:test";
import axios from "axios";
import bcrypt from "bcryptjs";
import { pool } from "../../config/db.ts";
import { exchange1C } from "../../app/modules/1cExchange.ts";
import { preview1cSync } from "../../app/modules/complectSync.ts";
import { normalizeName } from "../../app/modules/teacherNames.ts";
import TokenService from "../../app/services/Token.ts";
import type { UserClaims } from "../../app/types/express.ts";

type Command = { operation: "create" | "preview" | "state" | "cleanup"; runId: string;
  source?: unknown[]; complectId?: number; teacherNames: string[] };
const command = JSON.parse(readFileSync(0, "utf8")) as Command;
assert.equal(process.env.DB_PORT, "5433", "Driver разрешён только на синтетической БД 5433");
assert.ok(["localhost", "127.0.0.1"].includes(process.env.DB_HOST ?? "localhost"));
assert.match(command.runId, /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i);
assert.equal(command.teacherNames.length, 10);

const faculty = `Синтетический крупный план ${command.runId}`;
const profile = `Проверка крупного apply ${command.runId}`;
const actorLogin = `large-${command.runId.slice(0, 12)}`;
const surnames = command.teacherNames.map((name) => name.split(" ")[0]);
const keys = command.teacherNames.map(normalizeName);
const criteria = { faculty, year: 2097, educationForm: "Очная", educationLevel: "Бакалавриат",
  profile, direction: "09.03.01 synthetic" };

console.log = () => {};
console.warn = () => {};
console.error = () => {};
mock.method(axios, "post", async (url: string) => {
  assert.ok(url.endsWith("/GetDisciplinesByPlan"), "Подменяется только внешний GetDisciplinesByPlan");
  return { data: command.source ?? [] };
});

async function actor(): Promise<UserClaims> {
  const { rows } = await pool.query<{ id: number; role: number }>(
    "SELECT id,role FROM users WHERE name=$1", [actorLogin]);
  assert.equal(rows.length, 1);
  return { id: rows[0].id, role: rows[0].role, userName: actorLogin };
}

async function create() {
  const password = await bcrypt.hash(command.runId, 4);
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO users(name,password,role,fullname,is_active) VALUES($1,$2,3,$3,TRUE) RETURNING id",
    [actorLogin, password, { surname: `Руководителев${command.runId.slice(0, 8)}`, name: "Синтетик", patronymic: "Проверкович" }]);
  const current: UserClaims = { id: rows[0].id, role: 3, userName: actorLogin };
  const id = await exchange1C(criteria, { actor: current });
  const { rows: templates } = await pool.query<{ id: number }>(
    "SELECT id FROM rpd_profile_templates WHERE id_rpd_complect=$1 ORDER BY id LIMIT 1", [id]);
  const { rows: teachers } = await pool.query<{ id: number }>(
    "SELECT id FROM users WHERE fullname->>'surname'=$1", [surnames[0]]);
  assert.equal(templates.length, 1);
  assert.equal(teachers.length, 1);
  await pool.query("UPDATE rpd_profile_templates SET goals=$1,content=$2::jsonb WHERE id=$3",
    ["<p>Авторское содержание синтетической РПД</p>", JSON.stringify([{ theme: "Тема для проверки сохранности" }]), templates[0].id]);
  await pool.query("UPDATE template_status SET current_status='in_progress' WHERE id_profile_template=$1", [templates[0].id]);
  await pool.query("INSERT INTO teacher_templates(user_id,template_id,state) VALUES($1,$2,'in_progress')",
    [teachers[0].id, templates[0].id]);
  return { id, actorId: current.id, token: await TokenService.generateAccessToken(current) };
}

async function state() {
  const id = command.complectId;
  assert.equal(typeof id, "number");
  const queries = {
    complects: "SELECT * FROM rpd_complects WHERE id=$1",
    owners: "SELECT * FROM user_complect WHERE complect_id=$1 ORDER BY id",
    exchange: "SELECT * FROM rpd_1c_exchange WHERE id_rpd_complect=$1 ORDER BY id",
    profiles: "SELECT * FROM rpd_profile_templates WHERE id_rpd_complect=$1 ORDER BY id",
    statuses: `SELECT s.* FROM template_status s JOIN rpd_1c_exchange e ON e.id=s.id_1c_template
      WHERE e.id_rpd_complect=$1 ORDER BY s.id`,
    participants: `SELECT t.* FROM teacher_templates t JOIN rpd_profile_templates p ON p.id=t.template_id
      WHERE p.id_rpd_complect=$1 ORDER BY t.id`,
    syncLog: "SELECT * FROM complect_sync_log WHERE complect_id=$1 ORDER BY id",
    changes: `SELECT c.* FROM template_field_changes c JOIN complect_sync_log l ON l.id=c.sync_log_id
      WHERE l.complect_id=$1 ORDER BY c.id`,
  };
  const result: Record<string, unknown[]> = {};
  for (const [name, sql] of Object.entries(queries)) result[name] = (await pool.query(sql, [id])).rows;
  result.users = (await pool.query(`SELECT id,name,role,fullname,is_active,password IS NOT NULL AS has_password
    FROM users WHERE name=$1 OR fullname->>'surname'=ANY($2::text[]) ORDER BY id`, [actorLogin, surnames])).rows;
  result.cards = (await pool.query(`SELECT source,label_key,label,user_id FROM teacher_source_cards
    WHERE label_key=ANY($1::text[]) ORDER BY label_key`, [keys])).rows;
  return result;
}

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM rpd_complects WHERE faculty=$1 AND profile=$2", [faculty, profile]);
    await client.query("DELETE FROM teacher_source_cards WHERE label_key=ANY($1::text[])", [keys]);
    // Keep fixture users until test DB teardown; parallel tests snapshot all existing users.
    await client.query("COMMIT");
    return { cleaned: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function run() {
  if (command.operation === "create") return create();
  if (command.operation === "preview") return preview1cSync(command.complectId, await actor());
  if (command.operation === "state") return state();
  if (command.operation === "cleanup") return cleanup();
  assert.fail("Неизвестная операция driver");
}

try { process.stdout.write(JSON.stringify(await run())); }
catch (error) {
  process.stderr.write(error instanceof Error ? error.message : "Ошибка проверки крупного запроса");
  process.exitCode = 1;
} finally { mock.restoreAll(); await pool.end(); }
