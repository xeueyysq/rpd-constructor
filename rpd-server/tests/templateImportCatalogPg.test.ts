import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { Pool } from "pg";
import TemplateImport from "../app/services/TemplateImport.ts";
import { USER_ROLES } from "../app/models/constants.ts";

const connectionString = process.env.RPD_TEST_PG_URL;
const enabled = (() => {
  if (!connectionString) return false;
  const url = new URL(connectionString);
  if (url.hostname !== "127.0.0.1" || url.port !== "5433" || url.pathname !== "/rpd_e2e")
    throw new Error("Разрешена только синтетическая БД 127.0.0.1:5433/rpd_e2e");
  return true;
})();

test("PostgreSQL: каталог фильтрует назначения, статусы и поиск до страниц и деталей", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString, max: 2 });
  t.after(() => pool.end());
  const base = randomInt(500_000_000, 900_000_000);
  const nonce = randomBytes(6).toString("hex");
  const teacherId = base;
  const ropId = base + 1;
  const targetComplect = base + 10;
  const sameYear = base + 11;
  const older = base + 12;
  const foreign = base + 13;
  const target = base + 20;
  const matching = base + 21;
  const ownOther = base + 22;
  const foreignTemplate = base + 23;
  await pool.query("INSERT INTO users(id,name,password,role,fullname) VALUES($1,$2,'no-login',2,'{}'::jsonb),($3,$4,'no-login',3,'{}'::jsonb)",
    [teacherId, `cat-t-${nonce}`, ropId, `cat-r-${nonce}`]);
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$9,2026,'Очная','Бакалавриат','Цель','09.03.01'),
      ($3,$4,$9,2026,'Очная','Бакалавриат','Профиль А','09.03.02'),
      ($5,$6,$9,2025,'Заочная','Магистратура','Профиль Б','09.04.01'),
      ($7,$8,$10,2024,'Очная','Бакалавриат','Чужой профиль','09.03.03')`,
    [targetComplect, randomUUID(), sameYear, randomUUID(), older, randomUUID(), foreign, randomUUID(), `Факультет ${nonce}`, `Чужой ${nonce}`]);
  await pool.query(`INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,field_edits)
    VALUES($1,$2,$3,' Архитектура   систем ', '{}'::jsonb),
      ($4,$5,$6,'АРХИТЕКТУРА СИСТЕМ','{}'::jsonb),
      ($7,$8,$9,'Алгоритмы','{}'::jsonb),
      ($10,$11,$12,'Чужая дисциплина','{}'::jsonb)`,
    [target, randomBytes(6).toString("hex"), targetComplect, matching, randomBytes(6).toString("hex"), sameYear,
      ownOther, randomBytes(6).toString("hex"), older, foreignTemplate, randomBytes(6).toString("hex"), foreign]);
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'in_progress'),($4,$2,$5,'done'),($6,$2,$7,'assigned')",
    [base + 30, teacherId, target, base + 31, matching, base + 32, ownOther]);
  await pool.query("INSERT INTO user_complect(id,user_id,complect_id) VALUES($1,$2,$3)",
    [base + 40, ropId, targetComplect]);
  await pool.query("INSERT INTO template_status(id,id_profile_template,current_status) VALUES($1,$2,'ready')",
    [base + 50, matching]);
  const service = new TemplateImport(pool);
  const teacher = { id: teacherId, role: USER_ROLES.TEACHER, userName: `cat-t-${nonce}` };
  const rop = { id: ropId, role: USER_ROLES.ROP, userName: `cat-r-${nonce}` };
  const context = { targetTemplateId: String(target), page: "1", pageSize: "1" };
  const page = await service.catalog(teacher, context);
  assert.equal(page.pageSize, 1);
  assert.equal(page.total, 2);
  assert.equal(page.complects[0].id, sameYear, "то же название ранжируется перед старым годом");
  assert.equal(page.complects[0].templateCount, 1);
  assert.equal(page.complects[0].matchingTemplateCount, 1);
  assert.deepEqual(page.facets.faculties, [`Факультет ${nonce}`]);
  assert.deepEqual(page.facets.educationLevels, ["Бакалавриат", "Магистратура"]);
  const narrowed = await service.catalog(teacher, { ...context, faculty: `Факультет ${nonce}`,
    educationLevel: "Бакалавриат", direction: "09.03.02" });
  assert.deepEqual(narrowed.facets.faculties, [`Факультет ${nonce}`]);
  assert.deepEqual(narrowed.facets.directions, ["09.03.02"]);
  assert.deepEqual(narrowed.facets.profiles, ["Профиль А"]);
  assert.deepEqual(narrowed.facets.educationForms, ["Очная"]);
  assert.deepEqual(narrowed.facets.years, [2026]);
  const second = await service.catalog(teacher, { ...context, page: "2" });
  assert.equal(second.complects[0].id, older);
  assert.deepEqual((await service.catalog(teacher, { ...context, status: "ready" })).complects.map((row) => row.id), [sameYear]);
  assert.equal((await service.catalog(teacher, { ...context, search: "Алгоритмы" })).complects[0].id, older);
  assert.equal((await service.catalog(teacher, { ...context, search: "Чужая дисциплина" })).total, 0);
  assert.equal((await service.catalog(teacher, { ...context, search: "%_" })).total, 0, "шаблонные символы поиска буквальны");
  assert.equal((await service.catalog(teacher, { ...context, sourceMode: "other-year" })).total, 1);
  const unknownSourceComplect = base + 14;
  const unknownTargetComplect = base + 15;
  const unknownSource = base + 24;
  const unknownTarget = base + 25;
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$5,NULL,'Очная','Бакалавриат','Без года источник','09.03.04'),
      ($3,$4,$5,NULL,'Очная','Бакалавриат','Без года цель','09.03.05')`,
    [unknownSourceComplect, randomUUID(), unknownTargetComplect, randomUUID(), `Факультет ${nonce}`]);
  await pool.query(`INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,field_edits)
    VALUES($1,$2,$3,'Историческая РПД','{}'::jsonb),($4,$5,$6,'Целевая РПД','{}'::jsonb)`,
    [unknownSource, randomBytes(6).toString("hex"), unknownSourceComplect,
      unknownTarget, randomBytes(6).toString("hex"), unknownTargetComplect]);
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'assigned'),($4,$2,$5,'assigned')",
    [base + 33, teacherId, unknownSource, base + 34, unknownTarget]);
  assert.ok((await service.catalog(teacher, context)).complects.length > 0);
  assert.equal((await service.catalog(teacher, { ...context, sourceMode: "other-year", search: "Историческая РПД" })).total, 0,
    "источник без года не считается другим годом");
  assert.equal((await service.catalog(teacher, { targetTemplateId: String(unknownTarget), sourceMode: "other-year" })).total, 0,
    "цель без года не включает все известные источники");
  assert.equal((await service.catalog(teacher, { ...context, search: "Историческая РПД" })).total, 1,
    "источник без года доступен в обычном выборе другого комплекта");
  assert.equal((await service.catalog(teacher, { ...context, sameNameOnly: "true" })).total, 1);
  assert.deepEqual((await service.sources(teacher, target, undefined, undefined,
    { ...context, sourceComplectId: String(sameYear), status: "ready" })).complects[0].templates.map((item) => item.id), [matching]);
  assert.deepEqual((await service.sources(teacher, target, undefined, undefined,
    { ...context, sourceComplectId: String(older), status: "ready" })).complects, []);
  assert.equal((await service.catalog(rop, { ...context, ownOnly: "true" })).total, 0);
  assert.ok((await service.catalog(rop, context)).total >= 3);
  await assert.rejects(service.catalog(teacher, { ...context, status: "unsupported" }), { status: 422 });
  await assert.rejects(service.catalog(teacher, { ...context, pageSize: "26" }), { status: 422 });
  await pool.query("DELETE FROM teacher_templates WHERE template_id=$1 AND user_id=$2", [matching, teacherId]);
  assert.equal((await service.catalog(teacher, { ...context, search: "АРХИТЕКТУРА СИСТЕМ" })).total, 0);
  assert.deepEqual((await service.sources(teacher, target, undefined, undefined,
    { ...context, sourceComplectId: String(sameYear) })).complects, []);
});
