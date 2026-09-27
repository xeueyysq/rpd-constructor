import test from "node:test";
import assert from "node:assert/strict";
import type { Pool, PoolClient } from "pg";
import { acknowledgeExchangeChanges, getExchangeChanges } from "../app/services/ComplectChanges.ts";
import { USER_ROLES } from "../app/models/constants.ts";

const actor = { id: 7, role: USER_ROLES.ROP, userName: "rop" };

test("изменения строки 1С включают преподавателей, новую и удалённую дисциплину", async () => {
  const fields = ["teachers", "__new__", "removed"];
  const db = { query: async (sql: string) => {
    if (sql.includes("FROM rpd_1c_exchange")) return { rows: [{ id_rpd_complect: 2 }] };
    if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
    return { rows: fields.map((field_key, id) => ({ id, field_key })) };
  } } as unknown as Pool;
  const result = await getExchangeChanges(db, actor, 11);
  assert.deepEqual(result.map((row) => row.field_key), fields);
});

test("подтверждение блокирует комплект, проверяет владельца и пересчитывает общий флаг в одной транзакции", async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string) => {
    calls.push(sql);
    if (sql.includes("RETURNING has_pending_changes")) return { rows: [{ has_pending_changes: false }] };
    if (sql.includes("FROM rpd_1c_exchange")) return { rows: [{ id_rpd_complect: 2 }] };
    if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
    if (sql.startsWith("UPDATE template_field_changes")) return { rowCount: 3, rows: [] };
    return { rows: [] };
  }, release: () => { calls.push("RELEASE"); } } as unknown as PoolClient;
  const db = { connect: async () => client } as unknown as Pool;
  assert.deepEqual(await acknowledgeExchangeChanges(db, actor, 11), { acknowledged: 3, hasPendingChanges: false });
  assert.equal(calls[0], "BEGIN");
  assert.ok(calls.findIndex((sql) => sql.includes("FOR UPDATE")) < calls.findIndex((sql) => sql.startsWith("UPDATE template_field_changes")));
  assert.ok(calls.findIndex((sql) => sql.includes("AS owner")) < calls.findIndex((sql) => sql.startsWith("UPDATE template_field_changes")));
  assert.equal(calls.at(-2), "COMMIT");
  assert.equal(calls.at(-1), "RELEASE");
});

test("чужой ROP не подтверждает изменения", async () => {
  const calls: string[] = [];
  const client = { query: async (sql: string) => {
    calls.push(sql);
    if (sql.includes("FROM rpd_1c_exchange")) return { rows: [{ id_rpd_complect: 2 }] };
    if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: false, active: true }] };
    return { rows: [] };
  }, release: () => undefined } as unknown as PoolClient;
  const db = { connect: async () => client } as unknown as Pool;
  await assert.rejects(acknowledgeExchangeChanges(db, actor, 11), { status: 403 });
  assert.equal(calls.includes("ROLLBACK"), true);
  assert.equal(calls.some((sql) => sql.startsWith("UPDATE template_field_changes")), false);
});
