import test from "node:test";
import assert from "node:assert/strict";
import type { Pool, PoolClient } from "pg";
import { replaceComplectOwner } from "../app/services/ComplectOwnership.ts";
import { USER_ROLES } from "../app/models/constants.ts";

const admin = { id: 1, role: USER_ROLES.ADMIN, userName: "admin" };

function database(targetIsActiveRop: boolean, actorRole: number = USER_ROLES.ADMIN, actorActive = true) {
  const calls: string[] = [];
  const client = { query: async (sql: string) => {
    calls.push(sql);
    if (sql.includes("FROM rpd_complects WHERE id::text")) return { rows: [{ id: 4 }] };
    if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: false, active: true }] };
    if (sql.includes("SELECT id,role,is_active FROM users WHERE id=$1")) return { rows: [{ id: admin.id, role: actorRole, is_active: actorActive }] };
    if (sql.includes("FROM users WHERE id=ANY")) return { rows: targetIsActiveRop ? [{ id: 8 }] : [] };
    return { rows: [{ id: 4 }] };
  }, release: () => { calls.push("RELEASE"); } } as unknown as PoolClient;
  return { db: { connect: async () => client } as unknown as Pool, calls };
}

test("admin заменяет владельца комплекта в одной транзакции", async () => {
  const { db, calls } = database(true);
  assert.deepEqual(await replaceComplectOwner(db, admin, 4, 8), { complectId: 4, userId: 8 });
  assert.ok(calls.findIndex((sql) => sql.includes("FOR SHARE")) < calls.findIndex((sql) => sql.startsWith("DELETE FROM user_complect")));
  assert.equal(calls.filter((sql) => sql.startsWith("INSERT INTO user_complect")).length, 1);
  assert.equal(calls.at(-2), "COMMIT");
});

test("неактивный или не ROP не удаляет прежнюю связь", async () => {
  const { db, calls } = database(false);
  await assert.rejects(replaceComplectOwner(db, admin, 4, 8), { status: 422 });
  assert.equal(calls.includes("ROLLBACK"), true);
  assert.equal(calls.some((sql) => sql.startsWith("DELETE FROM user_complect")), false);
});

test("устаревший admin JWT не разрешает назначение после понижения или деактивации", async () => {
  for (const [role, active] of [[USER_ROLES.ROP, true], [USER_ROLES.ADMIN, false]] as const) {
    const { db, calls } = database(true, role, active);
    await assert.rejects(replaceComplectOwner(db, admin, 4, 8), { status: 403 });
    assert.equal(calls.some((sql) => sql.startsWith("DELETE FROM user_complect")), false);
  }
});
