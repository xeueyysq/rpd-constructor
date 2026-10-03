import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { pool } from "../config/db.ts";
import * as sync from "../app/modules/complectSync.ts";
import { USER_ROLES } from "../app/models/constants.ts";

const actor = { id: 7, role: USER_ROLES.ROP, userName: "rop" };

test("уведомления редактора выбирают последнее изменение каждого поля независимо от подтверждения", async (t) => {
  let query = "";
  let values: unknown[] | undefined;
  t.mock.method(pool, "query", async (sql: string, params?: unknown[]) => {
    query = sql;
    values = params;
    return { rows: [{ id: 2, field_key: "zet", old_value: 3, new_value: 4 }] };
  });
  assert.equal(typeof sync.getLatestFieldChanges, "function");
  const rows = await sync.getLatestFieldChanges(10);
  assert.deepEqual(rows, [{ id: 2, field_key: "zet", old_value: 3, new_value: 4 }]);
  assert.match(query, /DISTINCT ON \(field_key\)/);
  assert.match(query, /ORDER BY field_key, applied_at DESC, id DESC/);
  assert.doesNotMatch(query, /acknowledged_at/);
  assert.deepEqual(values, [10, "__new__"]);
});

for (const selections of [[], [{ action: "update", id_1c: 404 }], [{ action: "update", id_1c: 11, fields: ["teachers"], incoming: { teachers: ["Новый преподаватель"] } }], [{ action: "update", id_1c: 11, fields: ["zet"], incoming: { zet: 4 } }]]) {
  test(`синхронизация обновляет дату и общий флаг только по своему журналу: ${JSON.stringify(selections)}`, async (t) => {
    const calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
    const local = { id: 11, id_rpd_complect: 2, discipline: "Тест", teachers: [], zet: 3, id_profile_template: null };
    t.mock.method(pool, "query", async (sql: string) => {
      if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
      if (sql.includes("FROM rpd_complects")) return { rows: [{ id: 2 }] };
      if (sql.includes("FROM rpd_1c_exchange")) return { rows: [local] };
      throw new Error(`Неожиданный запрос: ${sql}`);
    });
    const client = { query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO complect_sync_log")) return { rows: [{ id: 30 }] };
      if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
      return { rows: [] };
    }, release: () => { calls.push({ sql: "RELEASE", values: undefined }); } } as unknown as PoolClient;
    t.mock.method(pool, "connect", async () => client);
    assert.deepEqual(await sync.applySync({ complectId: 2, selections, actor }), { complectId: 2, syncLogId: 30 });
    const update = calls.find(({ sql }) => sql.includes("UPDATE rpd_complects"));
    assert.ok(update);
    assert.match(update.sql, /last_synced_at = NOW\(\)/);
    assert.match(update.sql, /has_pending_changes = EXISTS\s*\(\s*SELECT 1 FROM template_field_changes WHERE sync_log_id = \$2\s*\)/);
    assert.deepEqual(update.values, [2, 30]);
    assert.equal(calls[0].sql, "BEGIN");
    assert.equal(calls.at(-2)?.sql, "COMMIT");
    assert.equal(calls.at(-1)?.sql, "RELEASE");
    const changes = calls.filter(({ sql }) => sql.includes("INSERT INTO template_field_changes"));
    if (selections[0]?.id_1c === 11) {
      assert.equal(changes.length, 1);
      const selection = selections[0];
      assert.deepEqual(changes[0].values?.slice(0, 4), [30, 11, null, "fields" in selection ? selection.fields[0] : undefined]);
    } else {
      assert.equal(changes.length, 0);
    }
  });
}
