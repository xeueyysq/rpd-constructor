import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import router from "../app/routes/routes.ts";
import { pool } from "../config/db.ts";
import { USER_ROLES } from "../app/models/constants.ts";

// Этот тест использует глобальный pool маршрутов, поэтому запуск разрешён только
// с параметрами отдельной синтетической E2E БД. Без них обычный gate его пропускает.
const enabled = process.env.DB_HOST === "127.0.0.1" && process.env.DB_PORT === "5433"
  && process.env.DB_NAME === "rpd_e2e" && process.env.DB_USER === "rpd_e2e"
  && process.env.DB_PASSWORD === "rpd_e2e" && process.env.ACCESS_TOKEN_SECRET === "e2e-access-token-secret-only";

test("HTTP + PostgreSQL: каталог, назначения, Word preview/apply и защита цели", { skip: !enabled, timeout: 60_000 }, async (t) => {
  const base = randomInt(500_000_000, 900_000_000);
  const nonce = randomBytes(6).toString("hex");
  const ids = { teacher: base, rop: base + 1, targetComplect: base + 10,
    ownComplect: base + 11, foreignComplect: base + 12, olderComplect: base + 13,
    target: base + 20, own: base + 21, foreign: base + 22, older: base + 23,
    targetAssignment: base + 30, ownAssignment: base + 31 };
  // Только собственные случайные строки; БД эфемерна и удаляется E2E-обвязкой.
  await pool.query("INSERT INTO users(id,name,password,role,fullname) VALUES($1,$2,'no-login',2,'{}'::jsonb),($3,$4,'no-login',3,'{}'::jsonb)",
    [ids.teacher, `ht-${nonce}`, ids.rop, `hr-${nonce}`]);
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$9,2026,'Очная','Бакалавриат','Цель','09.03.01'),
      ($3,$4,$9,2026,'Очная','Бакалавриат','Свой источник','09.03.02'),
      ($5,$6,$9,2025,'Заочная','Магистратура','Чужой источник','09.04.01'),
      ($7,$8,$9,2024,'Очная','Бакалавриат','Старый источник','09.03.03')`,
    [ids.targetComplect, randomUUID(), ids.ownComplect, randomUUID(), ids.foreignComplect,
      randomUUID(), ids.olderComplect, randomUUID(), `HTTP PG ${nonce}`]);
  await pool.query(`INSERT INTO rpd_profile_templates
    (id,public_id,id_rpd_complect,disciplins_name,goals,content,competencies,study_load,assessment_tools_template,field_edits)
    VALUES($1,$2,$3,'Архитектура систем','Старые цели','{}'::jsonb,'{"protected":1}'::jsonb,'{"plan":1}'::jsonb,'ФОС цели','{}'::jsonb),
      ($4,$5,$6,'Архитектура систем','Свои цели','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'ФОС источника','{}'::jsonb),
      ($7,$8,$9,'Чужая дисциплина','Чужие цели','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'ФОС источника','{}'::jsonb),
      ($10,$11,$12,'Алгоритмы','Старые цели','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'ФОС источника','{}'::jsonb)`,
    [ids.target, randomBytes(6).toString("hex"), ids.targetComplect,
      ids.own, randomBytes(6).toString("hex"), ids.ownComplect,
      ids.foreign, randomBytes(6).toString("hex"), ids.foreignComplect,
      ids.older, randomBytes(6).toString("hex"), ids.olderComplect]);
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'in_progress'),($4,$2,$5,'done')",
    [ids.targetAssignment, ids.teacher, ids.target, ids.ownAssignment, ids.own]);
  await pool.query("INSERT INTO user_complect(id,user_id,complect_id) VALUES($1,$2,$3)",
    [base + 40, ids.rop, ids.targetComplect]);
  await pool.query("INSERT INTO template_status(id,id_profile_template,current_status) VALUES($1,$2,'ready')",
    [base + 50, ids.foreign]);
  await pool.query(`INSERT INTO rpd_1c_exchange
    (id,id_rpd_complect,department,discipline,teachers,zet,record_type,study_load,control_load,semester)
    VALUES($1,$2,'Синтетическая кафедра','Архитектура систем',ARRAY[]::text[],3,'discipline','{"plan":1}'::jsonb,'{}'::jsonb,1)`,
    [base + 60, ids.targetComplect]);
  await pool.query("INSERT INTO template_status(id,id_1c_template,id_profile_template,current_status) VALUES($1,$2,$3,'in_progress')",
    [base + 51, base + 60, ids.target]);

  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(((error, _req, res, _next) => {
    void _next;
    const status = error && typeof error === "object" && "status" in error && typeof error.status === "number"
      ? error.status : 500;
    res.status(status).json({ status });
  }) as ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await pool.end(); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const actor = (id: number, role: number) => ({ Authorization: `Bearer ${jwt.sign({ id, role, userName: `http-pg-${nonce}` }, process.env.ACCESS_TOKEN_SECRET!)}` });
  const teacher = actor(ids.teacher, USER_ROLES.TEACHER);
  const rop = actor(ids.rop, USER_ROLES.ROP);
  const get = (path: string, headers = teacher) => fetch(`${url}${path}`, { headers });
  const post = (path: string, data: unknown, headers = teacher) => fetch(`${url}${path}`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const targetQuery = `targetTemplateId=${ids.target}`;

  assert.equal((await fetch(`${url}/template-import/catalog?${targetQuery}`)).status, 401);
  assert.equal((await get(`/template-import/catalog?targetTemplateId=${ids.foreign}`)).status, 403);
  const catalogResponse = await get(`/template-import/catalog?${targetQuery}&pageSize=1`);
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json() as { total: number; complects: Array<{ id: number }>; facets: { faculties: string[] } };
  assert.equal(catalog.total, 1, "преподаватель видит только назначенный источник");
  assert.deepEqual(catalog.complects.map((row) => row.id), [ids.ownComplect]);
  assert.deepEqual(catalog.facets.faculties, [`HTTP PG ${nonce}`]);
  const details = await get(`/template-import/sources?${targetQuery}&sourceComplectId=${ids.ownComplect}`);
  assert.equal(details.status, 200);
  assert.deepEqual(((await details.json()) as { complects: Array<{ templates: Array<{ id: number }> }> }).complects[0].templates.map((item) => item.id), [ids.own]);
  const legacyPreview = await get(`/get-changeable-values?ids%5B%5D=${ids.own}&rowName=goals&${targetQuery}`);
  assert.equal(legacyPreview.status, 200);
  const legacyRows = await legacyPreview.json() as Array<{ id: number; goals: string }>;
  assert.deepEqual(legacyRows.map(({ id, goals }) => ({ id, goals })), [{ id: ids.own, goals: "Свои цели" }]);
  const foreignDetails = await get(`/template-import/sources?${targetQuery}&sourceComplectId=${ids.foreignComplect}`);
  assert.deepEqual(((await foreignDetails.json()) as { complects: unknown[] }).complects, []);
  assert.equal((await get(`/get-changeable-values?ids%5B%5D=${ids.foreign}&rowName=goals&${targetQuery}`)).status, 403);
  assert.equal((await post("/copy-template-data", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target,
    fieldToCopy: "goals", baseAt: null })).status, 403);
  const managerCatalog = await get(`/template-import/catalog?${targetQuery}&search=Чужая&faculty=${encodeURIComponent(`HTTP PG ${nonce}`)}&educationLevel=Магистратура&year=2025&status=ready&page=1&pageSize=1`, rop);
  assert.equal(managerCatalog.status, 200);
  const managerPage = await managerCatalog.json() as { total: number; complects: Array<{ id: number }> };
  assert.equal(managerPage.total, 1);
  assert.deepEqual(managerPage.complects.map((row) => row.id), [ids.foreignComplect]);
  const emptyPage = await get(`/template-import/catalog?${targetQuery}&faculty=${encodeURIComponent(`HTTP PG ${nonce}`)}&educationLevel=Магистратура&year=2026`, rop);
  assert.equal(((await emptyPage.json()) as { total: number; complects: unknown[] }).total, 0);
  const managerOwn = await get(`/template-import/catalog?${targetQuery}&ownOnly=true`, rop);
  assert.equal(((await managerOwn.json()) as { total: number }).total, 0);
  const standaloneSingle = await get(`/template-import/sources?${targetQuery}&sourceComplectId=${ids.foreignComplect}&status=ready`, rop);
  assert.deepEqual(((await standaloneSingle.json()) as { complects: Array<{ templates: Array<{ id: number }> }> }).complects[0].templates.map((row) => row.id), [ids.foreign],
    "самостоятельная РПД остаётся доступна для импорта одной дисциплины");
  const fixtureFacultyFilter = `&faculty=${encodeURIComponent(`HTTP PG ${nonce}`)}`;
  const standaloneBulk = await get(`/template-import/catalog?targetComplectId=${ids.targetComplect}&status=ready${fixtureFacultyFilter}`, rop);
  const standaloneBulkData = await standaloneBulk.json() as { total: number; facets: { faculties: string[]; educationLevels: string[] } };
  assert.equal(standaloneBulkData.total, 0, "массовый каталог не показывает РПД без записи 1С");
  assert.ok(!standaloneBulkData.facets.faculties.includes(`HTTP PG ${nonce}`));
  assert.deepEqual(standaloneBulkData.facets.educationLevels, []);
  await pool.query(`INSERT INTO rpd_1c_exchange
    (id,id_rpd_complect,department,discipline,teachers,zet,record_type,study_load,control_load,semester,removed_at)
    VALUES($1,$2,'Синтетическая кафедра','Алгоритмы',ARRAY[]::text[],3,'discipline','{}'::jsonb,'{}'::jsonb,1,NOW())`,
    [base + 64, ids.olderComplect]);
  await pool.query("INSERT INTO template_status(id,id_1c_template,id_profile_template,current_status) VALUES($1,$2,$3,'ready')",
    [base + 55, base + 64, ids.older]);
  const removedBulk = await get(`/template-import/catalog?targetComplectId=${ids.targetComplect}&status=ready${fixtureFacultyFilter}`, rop);
  const removedBulkData = await removedBulk.json() as { total: number; facets: { faculties: string[] } };
  assert.equal(removedBulkData.total, 0,
    "удалённая запись 1С не открывает источник для массового импорта");
  assert.ok(!removedBulkData.facets.faculties.includes(`HTTP PG ${nonce}`));

  // Два точных совпадения в одном комплекте имеют разные статусы. Фильтр
  // массового импорта проверяется после блокировки, на реальных строках БД.
  await pool.query(`INSERT INTO rpd_profile_templates
    (id,public_id,id_rpd_complect,disciplins_name,goals,content,field_edits)
    VALUES($1,$2,$3,'Алгоритмы','Другие старые цели','{}'::jsonb,'{}'::jsonb),
      ($4,$5,$6,'Алгоритмы','Другие новые цели','{}'::jsonb,'{}'::jsonb)`,
    [base + 24, randomBytes(6).toString("hex"), ids.targetComplect,
      base + 25, randomBytes(6).toString("hex"), ids.ownComplect]);
  await pool.query(`INSERT INTO rpd_1c_exchange
    (id,id_rpd_complect,department,discipline,teachers,zet,record_type,study_load,control_load,semester)
    VALUES($1,$2,'Синтетическая кафедра','Архитектура систем',ARRAY[]::text[],3,'discipline','{}'::jsonb,'{}'::jsonb,1),
      ($3,$2,'Синтетическая кафедра','Алгоритмы',ARRAY[]::text[],3,'discipline','{}'::jsonb,'{}'::jsonb,1),
      ($4,$5,'Синтетическая кафедра','Алгоритмы',ARRAY[]::text[],3,'discipline','{}'::jsonb,'{}'::jsonb,1)`,
    [base + 61, ids.ownComplect, base + 62, base + 63, ids.targetComplect]);
  await pool.query(`INSERT INTO template_status(id,id_1c_template,id_profile_template,current_status)
    VALUES($1,$2,$3,'ready'),($4,$5,$6,'in_progress'),($7,$8,$9,'in_progress')`,
    [base + 52, base + 61, ids.own, base + 53, base + 62, base + 25,
      base + 54, base + 63, base + 24]);
  const bulkCatalog = await get(`/template-import/catalog?targetComplectId=${ids.targetComplect}&status=ready${fixtureFacultyFilter}`, rop);
  const bulkData = await bulkCatalog.json() as { targetRevision: string; total: number;
    complects: Array<{ id: number }>; facets: { faculties: string[]; educationLevels: string[] } };
  assert.deepEqual(bulkData.complects.map((row) => row.id), [ids.ownComplect]);
  assert.equal(bulkData.total, 1);
  assert.ok(bulkData.facets.faculties.includes(`HTTP PG ${nonce}`));
  assert.deepEqual(bulkData.facets.educationLevels, ["Бакалавриат"], "фасеты не учитывают самостоятельную РПД");
  const bulkDetails = await get(`/template-import/sources?targetComplectId=${ids.targetComplect}&sourceComplectId=${ids.foreignComplect}&status=ready`, rop);
  assert.deepEqual(((await bulkDetails.json()) as { complects: unknown[] }).complects, []);
  const bulkRevision = bulkData.targetRevision;
  const bulkBody = { sourceComplectId: ids.ownComplect, targetComplectId: ids.targetComplect,
    targetRevision: bulkRevision, sourceStatus: "ready" };
  assert.equal((await post("/template-import/complect", { ...bulkBody, sourceStatus: "invalid" }, rop)).status, 422);
  const bulkResponse = await post("/template-import/complect", bulkBody, rop);
  assert.equal(bulkResponse.status, 200);
  const bulkResult = await bulkResponse.json() as { counts: { imported: number; skipped: number }; skipped: Array<{ reason: string }> };
  assert.equal(bulkResult.counts.imported, 1);
  assert.ok(bulkResult.skipped.some((entry) => entry.reason === "source_status"));
  assert.equal((await pool.query("SELECT goals FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0].goals, "Свои цели");
  assert.equal((await pool.query("SELECT goals FROM rpd_profile_templates WHERE id=$1", [base + 24])).rows[0].goals, "Другие старые цели");
  await pool.query("UPDATE template_status SET current_status='in_progress' WHERE id_profile_template=$1", [ids.own]);
  await pool.query("UPDATE rpd_profile_templates SET goals='Не копировать' WHERE id=$1", [ids.own]);
  const changedCatalog = await get(`/template-import/catalog?targetComplectId=${ids.targetComplect}&status=ready${fixtureFacultyFilter}`, rop);
  const changedRevision = (await changedCatalog.json() as { targetRevision: string }).targetRevision;
  const changedResult = await post("/template-import/complect", { ...bulkBody, targetRevision: changedRevision }, rop);
  assert.equal(changedResult.status, 200);
  assert.equal((await pool.query("SELECT goals FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0].goals, "Свои цели",
    "статус источника изменился после выбора — исключённая дисциплина не перезаписана");

  await pool.query("DELETE FROM teacher_templates WHERE id=$1", [ids.ownAssignment]);
  assert.equal((await post("/copy-template-data", { sourceTemplateId: ids.own, targetTemplateId: ids.target,
    fieldToCopy: "goals", baseAt: null })).status, 403, "отзыв назначения действует после загрузки каталога");
  const afterRevoke = await get(`/template-import/catalog?${targetQuery}`);
  assert.equal(((await afterRevoke.json()) as { total: number }).total, 0);

  const protectedColumns = `goals,content,competencies,study_load,assessment_tools_template,
    assessment_tools_questions,disciplins_name,semester,department,zet,certification,id_rpd_complect,field_edits`;
  const before = (await pool.query(`SELECT ${protectedColumns} FROM rpd_profile_templates WHERE id=$1`, [ids.target])).rows[0];
  const exchangeBefore = (await pool.query("SELECT to_jsonb(e) AS row FROM rpd_1c_exchange e WHERE id=$1", [base + 60])).rows[0].row;
  const wordPath = `/templates/${ids.target}/import-word`;
  const docx = readFileSync(new URL("./fixtures/avs-programma-ivt-trpo-2024.docx", import.meta.url));
  const form = (bytes: Uint8Array) => { const data = new FormData();
    data.set("file", new Blob([Uint8Array.from(bytes).buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), "rpd.docx");
    return data; };
  const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1);
  assert.equal((await fetch(`${url}${wordPath}/preview`, { method: "POST", body: form(tooLarge) })).status, 401);
  assert.equal((await fetch(`${url}/templates/${ids.foreign}/import-word/preview`, { method: "POST", headers: teacher, body: form(tooLarge) })).status, 403);
  assert.equal((await fetch(`${url}${wordPath}/preview`, { method: "POST", headers: teacher, body: form(Buffer.from("bad")) })).status, 422);
  assert.equal((await fetch(`${url}${wordPath}/preview`, { method: "POST", headers: teacher, body: form(tooLarge) })).status, 413);
  const previewResponse = await fetch(`${url}${wordPath}/preview`, { method: "POST", headers: teacher, body: form(docx) });
  assert.equal(previewResponse.status, 200);
  const preview = await previewResponse.json() as { targetRevision: string; source: { discipline: string };
    availableFields: string[]; values: { goals: string; textbook: string[] } };
  assert.equal(preview.source.discipline, "Архитектура вычислительных систем");
  assert.ok(preview.availableFields.includes("goals"));
  assert.deepEqual((await pool.query(`SELECT ${protectedColumns} FROM rpd_profile_templates WHERE id=$1`, [ids.target])).rows[0], before,
    "предпросмотр не изменяет БД");
  const applyBody = { expectedRevision: preview.targetRevision, mode: "replace", selectedFields: ["goals"], values: { goals: preview.values.goals } };
  const apply = await post(`${wordPath}/apply`, applyBody);
  assert.equal(apply.status, 200);
  const applied = await apply.json() as { updatedFields: string[]; targetRevision: string };
  assert.deepEqual(applied.updatedFields, ["goals"]);
  assert.notEqual(applied.targetRevision, preview.targetRevision);
  const after = (await pool.query(`SELECT ${protectedColumns} FROM rpd_profile_templates WHERE id=$1`, [ids.target])).rows[0];
  assert.equal(after.goals.replaceAll("<br/>", "\n"), preview.values.goals);
  for (const key of ["content", "competencies", "study_load", "assessment_tools_template",
    "assessment_tools_questions", "disciplins_name", "semester", "department", "zet", "certification", "id_rpd_complect"])
    assert.deepEqual(after[key], before[key], key);
  assert.deepEqual((await pool.query("SELECT to_jsonb(e) AS row FROM rpd_1c_exchange e WHERE id=$1", [base + 60])).rows[0].row,
    exchangeBefore, "учебный план 1С не меняется");
  assert.equal((await post(`${wordPath}/apply`, applyBody)).status, 409);
  await pool.query("DELETE FROM teacher_templates WHERE id=$1", [ids.targetAssignment]);
  assert.equal((await post(`${wordPath}/apply`, { ...applyBody, expectedRevision: applied.targetRevision })).status, 403);
});
