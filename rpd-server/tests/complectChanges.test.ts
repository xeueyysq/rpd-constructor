import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { getExchangeChanges } from "../app/services/ComplectChanges.ts";
import { USER_ROLES } from "../app/models/constants.ts";

const actor = { id: 7, role: USER_ROLES.ROP, userName: "rop" };

test("диалог выбирает последнюю синхронизацию строки, включая подтверждённые изменения преподавателей и маркеры", async () => {
  const fields = ["teachers", "__new__", "removed"];
  let query = "";
  let values: unknown[] | undefined;
  const db = { query: async (sql: string, params?: unknown[]) => {
    if (sql.includes("FROM rpd_1c_exchange")) return { rows: [{ id_rpd_complect: 2 }] };
    if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
    query = sql;
    values = params;
    return { rows: fields.map((field_key, id) => ({ id, field_key, old_value: null, new_value: null, applied_at: new Date("2025-02-02T00:00:00Z"), id_profile_template: null })) };
  } } as unknown as Pool;
  const result = await getExchangeChanges(db, actor, "11");
  assert.deepEqual(result.map((row) => row.field_key), fields);
  assert.match(query, /sync_log_id\s*=\s*\(\s*SELECT MAX\(sync_log_id\) FROM template_field_changes WHERE id_1c_exchange=\$1\s*\)/);
  assert.doesNotMatch(query, /acknowledged_at/);
  assert.match(query, /ORDER BY applied_at,id/);
  assert.deepEqual(values, [11]);
});

test("чужой РОП не читает изменения строки", async () => {
  let readChanges = false;
  const db = { query: async (sql: string) => {
    if (sql.includes("FROM rpd_1c_exchange")) return { rows: [{ id_rpd_complect: 2 }] };
    if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: false, active: true }] };
    readChanges = true;
    return { rows: [] };
  } } as unknown as Pool;
  await assert.rejects(getExchangeChanges(db, actor, 11), { status: 403 });
  assert.equal(readChanges, false);
});

test("несуществующая строка и некорректный ID отклоняются до чтения изменений", async () => {
  let queries = 0;
  const db = { query: async () => { queries++; return { rows: [] }; } } as unknown as Pool;
  for (const value of [null, 0, -1, 1.5, "битый ID"]) await assert.rejects(getExchangeChanges(db, actor, value), { status: 422 });
  assert.equal(queries, 0);
  await assert.rejects(getExchangeChanges(db, actor, 11), { status: 404 });
  assert.equal(queries, 1);
});
