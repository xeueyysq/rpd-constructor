import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";
import { USER_ROLES } from "../app/models/constants.ts";

test("get-changeable-values отвергает имя колонки вне whitelist до SQL", async () => {
  let queries = 0;
  const db = { query: async () => { queries++; return { rows: [] }; } } as unknown as Pool;
  const model = new RpdProfileTemplates(db);
  await assert.rejects(model.getChangeableValues([1], "content; DROP TABLE users", { id: 1, role: USER_ROLES.ADMIN, userName: "admin" }), { status: 422 });
  assert.equal(queries, 0);
});

test("get-changeable-values исключает недоступные шаблоны", async () => {
  let selectedIds: number[] = [];
  const db = { query: async (sql: string, params: unknown[]) => {
    if (sql.includes("AS active") && !sql.includes("AS participant")) return { rows: [{ active: true }] };
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: Number(params[0]) }] };
    if (sql.includes("AS participant")) return { rows: [{ exists: true, owner: Number(params[0]) === 1, participant: false, active: true }] };
    selectedIds = params[0] as number[];
    return { rows: [{ id: 1, content: {} }] };
  } } as unknown as Pool;
  const model = new RpdProfileTemplates(db);
  const rows = await model.getChangeableValues([1, 2], "content", { id: 7, role: USER_ROLES.ROP, userName: "rop" });
  assert.deepEqual(selectedIds, [1]);
  assert.deepEqual(rows, [{ id: 1, content: {} }]);
});
