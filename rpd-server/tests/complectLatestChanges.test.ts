import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import Rpd1cExchange from "../app/models/rpd_1c_exchange.ts";
import { findRpd } from "../app/services/Complects.ts";
import { USER_ROLES } from "../app/models/constants.ts";

test("findRpd выбирает максимальный sync_log_id пакетно и отдаёт latestChanges без pendingChanges", async () => {
  let query = "";
  let values: unknown[] | undefined;
  const db = { query: async (sql: string, params?: unknown[]) => {
    query = sql;
    values = params;
    return { rows: [
      { id: 11, discipline: "Тест", id_profile_template: null, status: "unloaded", sync_status: "updated", latest_count: 2, sync_changed_at: new Date("2025-02-02T00:00:00Z"), last_change_summary: ["zet"], has_profile_template: false },
      { id: 12, discipline: "Без изменений", id_profile_template: null, sync_status: "unchanged", latest_count: 0, sync_changed_at: null, last_change_summary: [], has_profile_template: false },
    ] };
  } } as unknown as Pool;
  const rows = await new Rpd1cExchange(db).findRpd(2);
  assert.deepEqual(rows[0].latestChanges, { count: 2, lastAppliedAt: new Date("2025-02-02T00:00:00Z") });
  assert.deepEqual(rows[1].latestChanges, { count: 0, lastAppliedAt: null });
  assert.equal("pendingChanges" in rows[0], false);
  assert.match(query, /MAX\(tfc.sync_log_id\)/);
  assert.match(query, /tfc.sync_log_id\s*=\s*latest.sync_log_id/);
  assert.match(query, /COUNT\(\*\)::int AS latest_count/);
  assert.match(query, /GROUP BY tfc.id_1c_exchange/);
  assert.doesNotMatch(query, /acknowledged_at/);
  assert.match(query, /ch.latest_count, 0\) > 0 THEN 'updated'/);
  assert.deepEqual(values, [2]);
});

test("find-rpd отдаёт дату статуса из снимка и историю unloaded для строки без шаблона", async () => {
  const db = { query: async (sql: string) => {
    if (sql.includes("SELECT *") && sql.includes("FROM rpd_complects")) return { rows: [{ id: 2 }] };
    if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
    if (sql.includes("FROM rpd_1c_exchange r")) return { rows: [
      { id: 11, id_profile_template: 10, status: "created", teachers: [], status_history: [], latest_count: 0 },
      { id: 12, id_profile_template: null, status: "unloaded", teachers: [], status_history: [{ status: "unloaded", date: "2025-01-03T00:00:00Z" }], latest_count: 0 },
    ] };
    if (sql.includes("FROM template_status")) return { rows: [{ id_profile_template: 10, current_status: "created", history: [{ status: "created", date: "2025-01-02T00:00:00Z" }] }] };
    return { rows: [] };
  } } as unknown as Pool;
  const result = await findRpd(db, 2, { id: 7, role: USER_ROLES.ROP, userName: "rop" });
  assert.equal(result.templates[0].statusChangedAt, "2025-01-02T00:00:00.000Z");
  assert.equal(result.templates[1].statusChangedAt, "2025-01-03T00:00:00.000Z");
  assert.equal("status_history" in result.templates[1], false);
});
