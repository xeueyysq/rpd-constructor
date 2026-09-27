import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import type { UserClaims } from "../app/types/express.d.ts";
import { USER_ROLES } from "../app/models/constants.ts";
import TemplateAccess from "../app/services/TemplateAccess.ts";

const actor = (role: number): UserClaims => ({ id: 7, role, userName: "tester" });
const database = (rights: { exists: boolean; owner: boolean; participant: boolean; active: boolean }) => ({
  query: async () => ({ rows: [rights] }),
}) as unknown as Pool;

test("доступ к шаблону: admin, владелец и активный участник", async () => {
  await TemplateAccess.assertTemplate(database({ exists: true, owner: false, participant: false, active: true }), actor(USER_ROLES.ADMIN), 10, "manage");
  await TemplateAccess.assertTemplate(database({ exists: true, owner: true, participant: false, active: true }), actor(USER_ROLES.ROP), 10, "manage");
  await TemplateAccess.assertTemplate(database({ exists: true, owner: false, participant: true, active: true }), actor(USER_ROLES.TEACHER), 10, "edit");
  await assert.rejects(TemplateAccess.assertTemplate(database({ exists: true, owner: false, participant: true, active: true }), actor(USER_ROLES.TEACHER), 10, "manage"), { status: 403 });
});

test("чужой и деактивированный пользователь не получают доступ", async () => {
  await assert.rejects(TemplateAccess.assertTemplate(database({ exists: true, owner: false, participant: false, active: true }), actor(USER_ROLES.ROP), 10, "read"), { status: 403 });
  await assert.rejects(TemplateAccess.assertTemplate(database({ exists: true, owner: false, participant: true, active: false }), actor(USER_ROLES.TEACHER), 10, "read"), { status: 403 });
  await assert.rejects(TemplateAccess.assertTemplate(database({ exists: false, owner: false, participant: false, active: true }), actor(USER_ROLES.ADMIN), 10, "read"), { status: 404 });
});

test("управление комплектом: admin и ROP-владелец", async () => {
  const complectDb = (owner: boolean, active = true) => ({ query: async () => ({ rows: [{ exists: true, owner, active }] }) }) as unknown as Pool;
  await TemplateAccess.assertComplect(complectDb(false), actor(USER_ROLES.ADMIN), 2);
  await TemplateAccess.assertComplect(complectDb(true), actor(USER_ROLES.ROP), 2);
  await assert.rejects(TemplateAccess.assertComplect(complectDb(false), actor(USER_ROLES.ROP), 2), { status: 403 });
  await assert.rejects(TemplateAccess.assertComplect(complectDb(true), actor(USER_ROLES.TEACHER), 2), { status: 403 });
  await assert.rejects(TemplateAccess.assertComplect(complectDb(true, false), actor(USER_ROLES.ADMIN), 2), { status: 403 });
});
