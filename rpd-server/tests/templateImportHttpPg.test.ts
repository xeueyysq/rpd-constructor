import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { PoolClient } from "pg";
import router from "../app/routes/routes.ts";
import { pool } from "../config/db.ts";
import { USER_ROLES } from "../app/models/constants.ts";
import type { CopyTemplateResponse, ImportCatalogResponse } from "../app/types/templateImport.ts";

// Этот тест использует глобальный pool маршрутов, поэтому запуск разрешён только
// с параметрами отдельной синтетической E2E БД. Без них обычный gate его пропускает.
const enabled = process.env.DB_HOST === "127.0.0.1" && process.env.DB_PORT === "5433"
  && process.env.DB_NAME === "rpd_e2e" && process.env.DB_USER === "rpd_e2e"
  && process.env.DB_PASSWORD === "rpd_e2e" && process.env.ACCESS_TOKEN_SECRET === "e2e-access-token-secret-only";

test("HTTP + PostgreSQL: каталог, режимы импорта, перенос семестра, назначения и Word", { skip: !enabled, timeout: 60_000 }, async (t) => {
  const base = randomInt(500_000_000, 900_000_000);
  const nonce = randomBytes(6).toString("hex");
  const ids = { teacher: base, rop: base + 1, admin: base + 2, targetComplect: base + 10,
    ownComplect: base + 11, foreignComplect: base + 12, olderComplect: base + 13,
    target: base + 20, own: base + 21, foreign: base + 22, older: base + 23,
    targetAssignment: base + 30, ownAssignment: base + 31 };
  // Только собственные случайные строки; БД эфемерна и удаляется E2E-обвязкой.
  await pool.query("INSERT INTO users(id,name,password,role,fullname) VALUES($1,$2,'no-login',2,'{}'::jsonb),($3,$4,'no-login',3,'{}'::jsonb),($5,$6,'no-login',1,'{}'::jsonb)",
    [ids.teacher, `ht-${nonce}`, ids.rop, `hr-${nonce}`, ids.admin, `ha-${nonce}`]);
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$9,2026,'Очная','Бакалавриат','Цель','09.03.01'),
      ($3,$4,$9,2026,'Очная','Бакалавриат','Свой источник','09.03.02'),
      ($5,$6,$9,2025,'Заочная','Бакалавриат','Чужой источник','09.03.04'),
      ($7,$8,$9,2024,'Очная','Бакалавриат','Старый источник','09.03.03')`,
    [ids.targetComplect, randomUUID(), ids.ownComplect, randomUUID(), ids.foreignComplect,
      randomUUID(), ids.olderComplect, randomUUID(), `HTTP PG ${nonce}`]);
  await pool.query(`INSERT INTO rpd_profile_templates
    (id,public_id,id_rpd_complect,disciplins_name,goals,content,competencies,study_load,assessment_tools_template,field_edits)
    VALUES($1,$2,$3,'Архитектура систем','Старые цели','{}'::jsonb,'{"protected":1}'::jsonb,'{"plan":1}'::jsonb,'ФОС цели','{}'::jsonb),
      ($4,$5,$6,'Другое назначенное название','Свои цели','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'ФОС источника','{}'::jsonb),
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
  const admin = actor(ids.admin, USER_ROLES.ADMIN);
  const get = (path: string, headers = teacher) => fetch(`${url}${path}`, { headers });
  const post = (path: string, data: unknown, headers = teacher) => fetch(`${url}${path}`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const targetQuery = `targetTemplateId=${ids.target}`;
  const fixtureFacultyFilter = `&faculty=${encodeURIComponent(`HTTP PG ${nonce}`)}`;
  const targetRow = async () => (await pool.query("SELECT to_jsonb(p) AS row FROM rpd_profile_templates p WHERE id=$1", [ids.target])).rows[0].row;
  const changeWhileCopyWaits = async (path: string, body: unknown, change: (client: PoolClient) => Promise<unknown>) => {
    const blocker = await pool.connect();
    let pending: Promise<Response> | undefined;
    let committed = false;
    try {
      await blocker.query("BEGIN");
      const blockerPid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      await blocker.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [ids.targetComplect]);
      pending = post(path, body);
      const deadline = Date.now() + 10_000;
      while (!(await pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting", [blockerPid])).rows[0].waiting) {
        assert.ok(Date.now() < deadline, "HTTP copy должен дойти до настоящей блокировки");
        await delay(10);
      }
      await change(blocker);
      await blocker.query("COMMIT");
      committed = true;
      return await pending;
    } finally {
      if (!committed) await blocker.query("ROLLBACK");
      blocker.release();
      if (pending) await pending;
    }
  };

  assert.equal((await fetch(`${url}/template-import/catalog?${targetQuery}`)).status, 401);
  assert.equal((await get(`/template-import/catalog?targetTemplateId=${ids.foreign}`)).status, 403);
  const catalogResponse = await get(`/template-import/catalog?${targetQuery}&pageSize=1${fixtureFacultyFilter}`);
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json() as ImportCatalogResponse;
  assert.equal(catalog.scope, "single");
  assert.equal(catalog.total, 1, "single преподавателя включает только назначенные источники независимо от имени");
  assert.deepEqual(catalog.templates.map((row) => row.id), [ids.own]);
  assert.deepEqual(catalog.complects, []);
  assert.ok(catalog.facets.faculties.includes(`HTTP PG ${nonce}`));
  const details = await get(`/template-import/sources?${targetQuery}&sourceComplectId=${ids.ownComplect}`);
  assert.equal(details.status, 200);
  assert.deepEqual(((await details.json()) as { complects: Array<{ templates: Array<{ id: number }> }> }).complects[0].templates.map((item) => item.id), [ids.own]);
  const beforePreview = await targetRow();
  const sourceBeforePreview = (await pool.query("SELECT to_jsonb(p) AS row FROM rpd_profile_templates p WHERE id=$1", [ids.own])).rows[0].row;
  const legacyPreview = await get(`/get-changeable-values?ids%5B%5D=${ids.own}&rowName=goals&${targetQuery}`);
  assert.equal(legacyPreview.status, 200);
  const legacyRows = await legacyPreview.json() as Array<{ id: number; goals: string }>;
  assert.deepEqual(legacyRows.map(({ id, goals }) => ({ id, goals })), [{ id: ids.own, goals: "Свои цели" }]);
  assert.deepEqual(await targetRow(), beforePreview, "preview поля не изменяет цель");
  assert.deepEqual((await pool.query("SELECT to_jsonb(p) AS row FROM rpd_profile_templates p WHERE id=$1", [ids.own])).rows[0].row, sourceBeforePreview);
  const foreignDetails = await get(`/template-import/sources?${targetQuery}&sourceComplectId=${ids.foreignComplect}`);
  assert.deepEqual(((await foreignDetails.json()) as { complects: unknown[] }).complects, []);
  const fieldCatalog = await get(`/template-import/catalog?${targetQuery}&scope=field&ownOnly=false&sameNameOnly=false&status=ready${fixtureFacultyFilter}`);
  const fieldPage = await fieldCatalog.json() as ImportCatalogResponse;
  assert.equal(fieldPage.total, 1, "field игнорирует ready и имя, но принудительно сохраняет назначение");
  assert.deepEqual(fieldPage.templates.map((row) => row.id), [ids.own]);
  assert.equal((await get(`/get-changeable-values?ids%5B%5D=${ids.foreign}&rowName=goals&${targetQuery}&ownOnly=false&scope=single`)).status, 403);
  assert.equal((await post("/copy-template-data", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target,
    fieldToCopy: "goals", baseAt: null, ownOnly: false, scope: "single" })).status, 403);
  assert.deepEqual(await targetRow(), beforePreview);
  for (const ownOnly of [undefined, false]) {
    assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target, ownOnly })).status, 403);
  }
  for (const path of [`/template-import/catalog?targetComplectId=${ids.targetComplect}`,
    `/template-import/sources?targetComplectId=${ids.targetComplect}`]) assert.equal((await get(path)).status, 403);
  assert.equal((await post("/template-import/complect", { sourceComplectId: ids.ownComplect, targetComplectId: ids.targetComplect,
    targetRevision: catalog.targetRevision })).status, 403);
  assert.equal((await get(`/get-changeable-values?ids%5B%5D=${ids.foreign}&rowName=goals&${targetQuery}`, rop)).status, 200,
    "прямой preview РОП сохраняет прежнюю политику, имя — критерий каталога");
  assert.equal((await post("/rpd-profile-templates", { id: ids.foreign })).status, 403, "общий read не расширен");
  const managerCatalog = await get(`/template-import/catalog?${targetQuery}&search=Чужая${fixtureFacultyFilter}&educationLevel=Бакалавриат&year=2025&status=ready&page=1&pageSize=1`, rop);
  assert.equal(managerCatalog.status, 200);
  const managerPage = await managerCatalog.json() as ImportCatalogResponse;
  assert.equal(managerPage.total, 1);
  assert.deepEqual(managerPage.templates.map((row) => row.id), [ids.foreign]);
  const adminPage = await (await get(`/template-import/catalog?${targetQuery}&scope=single&search=Чужая${fixtureFacultyFilter}&year=2025`, admin)).json() as ImportCatalogResponse;
  assert.deepEqual(adminPage.templates.map((row) => row.id), [ids.foreign], "admin single не требует назначения");
  assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target,
    targetRevision: adminPage.targetRevision }, admin)).status, 200);
  const emptyPage = await get(`/template-import/catalog?${targetQuery}&faculty=${encodeURIComponent(`HTTP PG ${nonce}`)}&educationLevel=Магистратура&year=2026`, rop);
  assert.equal(emptyPage.status, 422, "клиентский уровень не может расширить каталог");
  const managerOwn = await get(`/template-import/catalog?${targetQuery}&scope=field&ownOnly=true`, rop);
  assert.equal(((await managerOwn.json()) as { total: number }).total, 0);
  assert.equal(((await (await get(`/template-import/catalog?${targetQuery}&scope=single&ownOnly=true`, rop)).json()) as ImportCatalogResponse).total, 0);
  assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target, ownOnly: true }, rop)).status, 403);

  await t.test("назначенная другая РПД того же комплекта: каталог/details/preview/apply, год и уровень", async () => {
    const sibling = base + 26;
    await pool.query(`INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,goals)
      VALUES($1,$2,$3,'Другое имя того же комплекта','Цели соседа')`, [sibling, randomBytes(6).toString("hex"), ids.targetComplect]);
    await pool.query("INSERT INTO teacher_templates(user_id,template_id,state) VALUES($1,$3,'assigned'),($2,$3,'done')", [ids.teacher, ids.rop, sibling]);
    for (const scope of ["field", "single"]) {
      const query = `${targetQuery}&scope=${scope}&sourceMode=other-year&sameNameOnly=true${fixtureFacultyFilter}`;
      const page = await (await get(`/template-import/catalog?${query}`)).json() as ImportCatalogResponse;
      assert.deepEqual(page.templates.map((row) => row.id).sort(), [ids.own, sibling].sort());
      const sameYear = await (await get(`/template-import/catalog?${query}&year=2026`)).json() as ImportCatalogResponse;
      assert.equal(sameYear.total, 2);
      assert.equal((await (await get(`/template-import/catalog?${query}&year=2025`)).json() as ImportCatalogResponse).total, 0);
      const details = await (await get(`/template-import/sources?${query}&sourceComplectId=${ids.targetComplect}`)).json() as { complects: Array<{ templates: Array<{ id: number }> }> };
      assert.deepEqual(details.complects[0].templates.map((row) => row.id), [sibling]);
      assert.equal((await post(scope === "field" ? "/copy-template-data" : "/copy-template-content", {
        sourceTemplateId: ids.target, targetTemplateId: ids.target, ...(scope === "field" ? { fieldToCopy: "goals", baseAt: null } : {}),
      })).status, 422);
      assert.equal((await post(scope === "field" ? "/copy-template-data" : "/copy-template-content", {
        sourceTemplateId: sibling, targetTemplateId: ids.target, ownOnly: false,
        ...(scope === "field" ? { fieldToCopy: "goals", baseAt: (await targetRow()).field_edits.goals?.at ?? null } : {}),
      })).status, 200);
      assert.equal((await targetRow()).goals, "Цели соседа");
      const switched = await (await get(`/template-import/catalog?${query}&ownOnly=true`, rop)).json() as ImportCatalogResponse;
      assert.deepEqual(switched.templates.map((row) => row.id), [sibling]);
    }
    assert.equal((await get(`/get-changeable-values?ids=${sibling}&rowName=goals&${targetQuery}`)).status, 200);
    assert.equal((await post("/copy-template-content", { sourceTemplateId: sibling, targetTemplateId: ids.target, ownOnly: true }, rop)).status, 200);
    assert.equal((await post("/copy-template-content", { sourceTemplateId: sibling, targetTemplateId: ids.target }, rop)).status, 422);
    await pool.query("UPDATE rpd_complects SET education_level='Магистратура' WHERE id=$1", [ids.ownComplect]);
    assert.deepEqual((await (await get(`/template-import/catalog?${targetQuery}${fixtureFacultyFilter}`)).json() as ImportCatalogResponse).templates.map((row) => row.id), [sibling]);
    await pool.query("UPDATE rpd_complects SET education_level='Бакалавриат' WHERE id=$1", [ids.ownComplect]);
    await pool.query("DELETE FROM rpd_profile_templates WHERE id=$1", [sibling]);
    await pool.query("UPDATE rpd_profile_templates SET field_edits='{}'::jsonb WHERE id=$1", [ids.target]);
  });
  const standaloneSingle = await get(`/template-import/sources?${targetQuery}&sourceComplectId=${ids.foreignComplect}&status=ready`, rop);
  assert.deepEqual(((await standaloneSingle.json()) as { complects: Array<{ templates: Array<{ id: number }> }> }).complects[0].templates.map((row) => row.id), [ids.foreign],
    "самостоятельная РПД остаётся доступна для импорта одной дисциплины");
  assert.equal((await (await get(`/template-import/catalog?scope=single&${targetQuery}&status=ready${fixtureFacultyFilter}`)).json() as ImportCatalogResponse).total, 0);
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'done')", [base + 32, ids.teacher, ids.foreign]);
  const readyResponse = await get(`/template-import/catalog?scope=single&${targetQuery}&status=ready&pageSize=1&ownOnly=true${fixtureFacultyFilter}`);
  const readyPage = await readyResponse.json() as ImportCatalogResponse;
  assert.equal(readyPage.total, 1);
  assert.deepEqual(readyPage.templates.map((row) => row.id), [ids.foreign], "ready применяется до пагинации");
  await pool.query("UPDATE rpd_profile_templates SET textbook=ARRAY['Книга источника'],content=$1::jsonb WHERE id=$2",
    ['{"1":{"theme":"Тема источника","lectures":2}}', ids.foreign]);
  const fullBefore = await targetRow();
  const fullBody = { sourceTemplateId: ids.foreign, targetTemplateId: ids.target, targetRevision: readyPage.targetRevision,
    sourceStatus: "ready", ownOnly: true, scope: "field" };
  const fullResponse = await post("/copy-template-content", fullBody);
  assert.equal(fullResponse.status, 200, "назначенный источник другого имени доступен single");
  const fullResult = await fullResponse.json() as CopyTemplateResponse;
  const fullAfter = await targetRow();
  assert.equal(fullAfter.goals, "Чужие цели");
  assert.deepEqual(fullAfter.textbook, ["Книга источника"]);
  assert.deepEqual(fullAfter.content, { "1": { theme: "Тема источника", lectures: 2 } });
  for (const key of ["id", "public_id", "id_rpd_complect", "disciplins_name", "competencies", "study_load", "assessment_tools_template"])
    assert.deepEqual(fullAfter[key], fullBefore[key], key);
  assert.equal(fullResult.targetTemplate.field_edits.goals.userId, ids.teacher);
  assert.ok(Number.isFinite(Date.parse(fullResult.targetTemplate.field_edits.goals.at)));
  assert.equal((await post("/copy-template-content", fullBody)).status, 409, "stale revision не пишет в БД");
  assert.equal((await post("/copy-template-data", { sourceTemplateId: ids.own, targetTemplateId: ids.target,
    fieldToCopy: "goals", baseAt: null, mode: "append" })).status, 409, "stale baseAt не пишет в БД");
  assert.deepEqual(await targetRow(), fullAfter);
  const changedReady = await changeWhileCopyWaits("/copy-template-content", { ...fullBody, targetRevision: fullResult.targetRevision, mode: "append" },
    (client) => client.query("UPDATE template_status SET current_status='created' WHERE id_profile_template=$1", [ids.foreign]));
  assert.equal(changedReady.status, 409, "готовность источника повторно проверяется после lock");
  assert.equal((await post("/copy-template-content", { ...fullBody, sourceStatus: "created" })).status, 422);
  assert.deepEqual(await targetRow(), fullAfter, "отказ по готовности сохраняет всю строку цели");
  await pool.query("UPDATE rpd_complects SET education_level='Магистратура' WHERE id=$1", [ids.foreignComplect]);
  assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target,
    ownOnly: false, targetRevision: fullResult.targetRevision })).status, 200,
  "без ready-only доступны все статусы; уровень — критерий каталога, а не запрет прямого копирования");
  await pool.query("UPDATE rpd_complects SET education_level='Бакалавриат' WHERE id=$1", [ids.foreignComplect]);

  await t.test("mode проходит через каждый controller; append и replace сохраняются в настоящем PG", async () => {
    const before = await targetRow();
    for (const mode of [null, "", "merge", false, 0, [], {}]) {
      assert.equal((await post("/copy-template-data", { sourceTemplateId: ids.own, targetTemplateId: ids.target,
        fieldToCopy: "goals", baseAt: before.field_edits.goals.at, mode })).status, 422);
      assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target, mode })).status, 422);
      assert.equal((await post("/template-import/complect", { sourceComplectId: ids.ownComplect,
        targetComplectId: ids.targetComplect, targetRevision: "unused", mode }, rop)).status, 422);
    }
    assert.deepEqual(await targetRow(), before);
    const fieldBody = { sourceTemplateId: ids.own, targetTemplateId: ids.target, fieldToCopy: "goals" };
    const fieldAppend = await post("/copy-template-data", { ...fieldBody, baseAt: before.field_edits.goals.at, mode: "append" });
    assert.equal(fieldAppend.status, 200);
    const appendedField = await targetRow();
    assert.equal(appendedField.goals, "Чужие цели<br/><br/>Свои цели");
    assert.equal(appendedField.field_edits.goals.userId, ids.teacher);
    assert.notEqual(appendedField.field_edits.goals.at, before.field_edits.goals.at);
    assert.ok(Date.parse(appendedField.field_edits.goals.at) >= Date.parse(before.field_edits.goals.at));
    assert.equal((await post("/copy-template-data", { ...fieldBody, baseAt: appendedField.field_edits.goals.at, mode: "replace" })).status, 200);
    assert.equal((await targetRow()).goals, "Свои цели");

    const targetContent = { "7": { theme: "Тема цели" }, future: { extension: true },
      __attestation__: { theme: "Экзамен цели", control: 36 } };
    await pool.query("UPDATE rpd_profile_templates SET content=$1::jsonb WHERE id=$2", [JSON.stringify(targetContent), ids.target]);
    const revision = (await (await get(`/template-import/catalog?${targetQuery}`)).json() as ImportCatalogResponse).targetRevision;
    const appendBody = { sourceTemplateId: ids.foreign, targetTemplateId: ids.target, targetRevision: revision, mode: "append" };
    const appendedResponse = await post("/copy-template-content", appendBody);
    assert.equal(appendedResponse.status, 200);
    const appended = await targetRow();
    assert.equal(appended.goals, "Свои цели<br/><br/>Чужие цели");
    assert.deepEqual(appended.textbook, ["Книга источника", "Книга источника"], "повторяемые элементы не удаляются");
    assert.deepEqual(appended.content, { ...targetContent, "8": { theme: "Тема источника", lectures: 2 } });
    assert.equal((await post("/copy-template-content", appendBody)).status, 409);
    assert.deepEqual(await targetRow(), appended);
    const appendedResult = await appendedResponse.json() as CopyTemplateResponse;
    await pool.query("UPDATE rpd_profile_templates SET goals=NULL,content=NULL,textbook=ARRAY[]::text[],software='' WHERE id=$1", [ids.foreign]);
    assert.equal((await post("/copy-template-content", { ...appendBody, targetRevision: appendedResult.targetRevision })).status, 200);
    const emptyAppend = await targetRow();
    for (const field of ["goals", "content", "textbook", "software"]) assert.deepEqual(emptyAppend[field], appended[field], field);
    const replaceRevision = (await (await get(`/template-import/catalog?${targetQuery}`)).json() as ImportCatalogResponse).targetRevision;
    const replaceResponse = await post("/copy-template-content", { ...appendBody, targetRevision: replaceRevision, mode: "replace" });
    assert.equal(replaceResponse.status, 200);
    const replaced = await targetRow();
    assert.equal(replaced.goals, null);
    assert.equal(replaced.content, null);
    assert.deepEqual(replaced.textbook, []);
    assert.equal(replaced.software, "");
    for (const key of ["id", "public_id", "id_rpd_complect", "disciplins_name", "competencies", "study_load", "assessment_tools_template"])
      assert.deepEqual(replaced[key], before[key], key);
    const replaceResult = await replaceResponse.json() as CopyTemplateResponse;
    assert.equal((await post("/copy-template-content", { ...appendBody, targetRevision: replaceResult.targetRevision })).status, 200);
    assert.equal((await pool.query("SELECT content IS NULL AS sql_null FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0].sql_null, true,
      "пустой append сохраняет SQL NULL, а не записывает JSON null");
  });

  for (const status of ["ready", "closed"]) {
    await pool.query("UPDATE template_status SET current_status=$1 WHERE id_profile_template=$2", [status, ids.target]);
    const lockedTarget = await targetRow();
    assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target })).status, 409);
    assert.deepEqual(await targetRow(), lockedTarget);
  }
  await pool.query("UPDATE template_status SET current_status='in_progress' WHERE id_profile_template=$1", [ids.target]);
  await pool.query("UPDATE rpd_1c_exchange SET removed_at=NOW() WHERE id=$1", [base + 60]);
  const beforeRemoved = await targetRow();
  assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target })).status, 409);
  assert.deepEqual(await targetRow(), beforeRemoved);
  await pool.query("UPDATE rpd_1c_exchange SET removed_at=NULL WHERE id=$1", [base + 60]);
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

  // Старый sourceStatus не исключает точные совпадения с разными статусами.
  await pool.query(`INSERT INTO rpd_profile_templates
    (id,public_id,id_rpd_complect,disciplins_name,goals,content,field_edits)
    VALUES($1,$2,$3,'Алгоритмы','Другие старые цели','{}'::jsonb,'{}'::jsonb),
      ($4,$5,$6,'Алгоритмы','Другие новые цели','{}'::jsonb,'{}'::jsonb)`,
    [base + 24, randomBytes(6).toString("hex"), ids.targetComplect,
      base + 25, randomBytes(6).toString("hex"), ids.ownComplect]);
  await pool.query(`INSERT INTO rpd_1c_exchange
    (id,id_rpd_complect,department,discipline,teachers,zet,record_type,study_load,control_load,semester)
    VALUES($1,$2,'Синтетическая кафедра','Архитектура систем',ARRAY[]::text[],3,'discipline','{}'::jsonb,'{}'::jsonb,1),
      ($3,$2,'Синтетическая кафедра','Алгоритмы',ARRAY[]::text[],3,'Б1.В.01','{}'::jsonb,'{}'::jsonb,1),
      ($4,$5,'Синтетическая кафедра','Алгоритмы',ARRAY[]::text[],3,'Б1.О.02','{}'::jsonb,'{}'::jsonb,1)`,
    [base + 61, ids.ownComplect, base + 62, base + 63, ids.targetComplect]);
  await pool.query(`INSERT INTO template_status(id,id_1c_template,id_profile_template,current_status)
    VALUES($1,$2,$3,'ready'),($4,$5,$6,'in_progress'),($7,$8,$9,'in_progress')`,
    [base + 52, base + 61, ids.own, base + 53, base + 62, base + 25,
      base + 54, base + 63, base + 24]);
  await pool.query("UPDATE rpd_1c_exchange SET semester=2 WHERE id=$1", [base + 60]);
  await pool.query("UPDATE rpd_profile_templates SET semester=2 WHERE id=$1", [ids.target]);
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
  const bulkResult = await bulkResponse.json() as { targetRevision: string; counts: { imported: number; skipped: number }; skipped: Array<{ reason: string }> };
  assert.equal(bulkResult.counts.imported, 2);
  assert.deepEqual(bulkResult.skipped, []);
  assert.equal((await pool.query("SELECT goals FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0].goals, "Свои цели");
  assert.equal((await pool.query("SELECT goals FROM rpd_profile_templates WHERE id=$1", [base + 24])).rows[0].goals, "Другие новые цели");
  assert.equal((await targetRow()).semester, 2, "перенос копирует содержание, сохраняя семестр цели");
  await t.test("bulk передаёт append и replace, в том числе для перенесённой пары", async () => {
    const content = { "7": { theme: "Тема bulk цели" }, __attestation__: { theme: "Экзамен bulk цели", control: 36 } };
    await pool.query("UPDATE rpd_profile_templates SET content=$1::jsonb WHERE id=$2", [JSON.stringify(content), ids.target]);
    await pool.query("UPDATE rpd_profile_templates SET content=$1::jsonb,textbook=ARRAY['Книга bulk'] WHERE id=$2",
      [JSON.stringify({ legacy: { theme: "Тема bulk источника", lectures: 1 }, __attestation__: { control: 99 } }), ids.own]);
    const bulkAppend = { ...bulkBody, targetRevision: bulkResult.targetRevision, mode: "append" };
    const response = await post("/template-import/complect", bulkAppend, rop);
    assert.equal(response.status, 200);
    const result = await response.json() as { targetRevision: string };
    const appended = await targetRow();
    assert.equal(appended.goals, "Свои цели<br/><br/>Свои цели");
    assert.deepEqual(appended.textbook, ["Книга bulk"]);
    assert.deepEqual(appended.content, { ...content, "8": { theme: "Тема bulk источника", lectures: 1 } });
    assert.equal(appended.field_edits.content.userId, ids.rop);
    assert.ok(Number.isFinite(Date.parse(appended.field_edits.content.at)));
    assert.equal((await post("/template-import/complect", bulkAppend, rop)).status, 409);
    assert.deepEqual(await targetRow(), appended);
    assert.equal((await post("/template-import/complect", { ...bulkAppend, targetRevision: result.targetRevision, mode: "replace" }, rop)).status, 200);
    assert.equal((await targetRow()).goals, "Свои цели");
    assert.equal((await targetRow()).semester, 2);
  });
  await pool.query("UPDATE template_status SET current_status='in_progress' WHERE id_profile_template=$1", [ids.own]);
  await pool.query("UPDATE rpd_profile_templates SET goals='Не копировать' WHERE id=$1", [ids.own]);
  const changedCatalog = await get(`/template-import/catalog?targetComplectId=${ids.targetComplect}&status=ready${fixtureFacultyFilter}`, rop);
  const changedRevision = (await changedCatalog.json() as { targetRevision: string }).targetRevision;
  const changedResult = await post("/template-import/complect", { ...bulkBody, targetRevision: changedRevision }, rop);
  assert.equal(changedResult.status, 200);
  assert.equal((await pool.query("SELECT goals FROM rpd_profile_templates WHERE id=$1", [ids.target])).rows[0].goals, "Не копировать",
    "смена статуса не исключает дисциплину из bulk");

  await t.test("HTTP bulk: разные коды, резервирование точных пар, дубли, 0 и пустые имена", async () => {
    const exchangeIds = [base + 61, base + 62, base + 60, base + 63];
    const original = (await pool.query("SELECT id,discipline,semester,record_type FROM rpd_1c_exchange WHERE id=ANY($1::int[])", [exchangeIds])).rows;
    const cases = [
      { name: "точная пара и единственный остаток без повторного использования", semesters: [1, 2, 2, 3], discipline: " Одно   имя ",
        pairs: [[ids.target, base + 25], [base + 24, ids.own]], reasons: [] },
      { name: "дубли с разными кодами остаются неоднозначными", semesters: [1, 1, 1, 2], discipline: "Одно имя",
        pairs: [], reasons: ["ambiguous", "missing_source"] },
      { name: "нулевой семестр не известен для переноса", semesters: [0, 0, 1, 2], discipline: "Одно имя",
        pairs: [], reasons: ["missing_source", "missing_source"] },
      { name: "пустое имя не сопоставляется даже точно", semesters: [1, 2, 1, 2], discipline: " \t ",
        pairs: [], reasons: ["missing_source", "missing_source"] },
    ];
    try {
      for (const row of cases) {
        for (const [index, id] of exchangeIds.entries()) await pool.query(
          "UPDATE rpd_1c_exchange SET discipline=$1,semester=$2,record_type=$3 WHERE id=$4",
          [row.discipline, row.semesters[index], `Б1.${index < 2 ? "В" : "О"}.${index}`, id]);
        const plan = (await pool.query("SELECT to_jsonb(e) AS row FROM rpd_1c_exchange e WHERE id=ANY($1::int[]) ORDER BY id", [exchangeIds])).rows;
        const before = (await pool.query("SELECT to_jsonb(p) AS row FROM rpd_profile_templates p WHERE id_rpd_complect=$1 ORDER BY id", [ids.targetComplect])).rows;
        const revision = (await (await get(`/template-import/catalog?targetComplectId=${ids.targetComplect}`, rop)).json() as ImportCatalogResponse).targetRevision;
        const response = await post("/template-import/complect", { ...bulkBody, targetRevision: revision }, rop);
        assert.equal(response.status, 200, row.name);
        const result = await response.json() as { imported: Array<{ targetTemplateId: number; sourceTemplateId: number }>; skipped: Array<{ reason: string }> };
        assert.deepEqual(result.imported.map((entry) => [entry.targetTemplateId, entry.sourceTemplateId]), row.pairs, row.name);
        assert.deepEqual(result.skipped.map((entry) => entry.reason), row.reasons, row.name);
        if (!row.pairs.length) assert.deepEqual((await pool.query("SELECT to_jsonb(p) AS row FROM rpd_profile_templates p WHERE id_rpd_complect=$1 ORDER BY id", [ids.targetComplect])).rows, before);
        assert.deepEqual((await pool.query("SELECT to_jsonb(e) AS row FROM rpd_1c_exchange e WHERE id=ANY($1::int[]) ORDER BY id", [exchangeIds])).rows, plan);
      }
    } finally {
      for (const row of original) await pool.query("UPDATE rpd_1c_exchange SET discipline=$1,semester=$2,record_type=$3 WHERE id=$4",
        [row.discipline, row.semester, row.record_type, row.id]);
    }
  });

  // sourceMode передаётся только каталогу/details; preview и запись поля сохраняют прежний контракт.
  await pool.query("UPDATE rpd_complects SET year=2025,profile='Цель',direction='09.03.01' WHERE id=$1", [ids.ownComplect]);
  const yearQuery = `${targetQuery}&scope=field&sourceMode=other-year&ownOnly=false&sameNameOnly=false`;
  const yearResponse = await get(`/template-import/catalog?${yearQuery}`);
  assert.equal(yearResponse.status, 200);
  const yearPage = await yearResponse.json() as ImportCatalogResponse;
  assert.equal(yearPage.total, 2);
  assert.deepEqual(yearPage.templates.map((row) => row.id).sort(), [ids.own, ids.foreign].sort());
  assert.deepEqual(yearPage.facets.years, [2025]);
  const yearDetails = await get(`/template-import/sources?${yearQuery}&sourceComplectId=${ids.ownComplect}`);
  assert.equal(yearDetails.status, 200);
  assert.deepEqual((await yearDetails.json() as { complects: Array<{ templates: Array<{ id: number }> }> }).complects[0].templates.map((row) => row.id), [ids.own]);
  const otherMode = await get(`/template-import/catalog?${targetQuery}&scope=field&sourceMode=other-complect${fixtureFacultyFilter}`);
  assert.deepEqual((await otherMode.json() as ImportCatalogResponse).templates.map((row) => row.id).sort(), [ids.own, ids.foreign].sort());
  await pool.query("UPDATE rpd_profile_templates SET goals='Полевые цели другого года' WHERE id=$1", [ids.own]);
  const beforeField = await targetRow();
  const fieldPreview = await get(`/get-changeable-values?ids%5B%5D=${ids.own}&rowName=goals&${targetQuery}`);
  assert.equal(fieldPreview.status, 200);
  assert.deepEqual(await fieldPreview.json(), [{ id: ids.own,
    public_id: sourceBeforePreview.public_id, goals: "Полевые цели другого года" }]);
  const fieldApplied = await post("/copy-template-data", { sourceTemplateId: ids.own, targetTemplateId: ids.target,
    fieldToCopy: "goals", baseAt: beforeField.field_edits.goals.at });
  assert.equal(fieldApplied.status, 200);
  const afterField = await targetRow();
  assert.equal(afterField.goals, "Полевые цели другого года");
  for (const key of Object.keys(beforeField).filter((key) => key !== "goals" && key !== "field_edits"))
    assert.deepEqual(afterField[key], beforeField[key], key);
  assert.equal(afterField.field_edits.goals.userId, ids.teacher);
  await pool.query("UPDATE rpd_complects SET year=2026,profile='Свой источник',direction='09.03.02' WHERE id=$1", [ids.ownComplect]);
  assert.equal((await (await get(`/template-import/catalog?${yearQuery}`)).json() as ImportCatalogResponse).total, 2,
    "teacher игнорирует скрытый other-year и имя");
  const beforeSingleRevoke = await targetRow();
  const singleRevoked = await changeWhileCopyWaits("/copy-template-content", { sourceTemplateId: ids.foreign,
    targetTemplateId: ids.target, ownOnly: false, mode: "append" },
  (client) => client.query("DELETE FROM teacher_templates WHERE id=$1", [base + 32]));
  assert.equal(singleRevoked.status, 403, "single повторно проверяет назначение под lock");
  assert.deepEqual(await targetRow(), beforeSingleRevoke);
  const beforeRevoke = await targetRow();
  const revokedCopy = await changeWhileCopyWaits("/copy-template-data", { sourceTemplateId: ids.own, targetTemplateId: ids.target,
    fieldToCopy: "goals", baseAt: beforeRevoke.field_edits.goals.at, ownOnly: false, mode: "append" },
  (client) => client.query("DELETE FROM teacher_templates WHERE id=$1", [ids.ownAssignment]));
  assert.equal(revokedCopy.status, 403, "назначение повторно проверяется после lock");
  assert.deepEqual(await targetRow(), beforeRevoke);
  const afterRevoke = await get(`/template-import/catalog?${targetQuery}&scope=field${fixtureFacultyFilter}`);
  assert.equal(((await afterRevoke.json()) as { total: number }).total, 0);
  const singleAfterRevoke = await get(`/template-import/catalog?${targetQuery}&scope=single${fixtureFacultyFilter}`);
  assert.equal(((await singleAfterRevoke.json()) as { total: number }).total, 0);
  assert.deepEqual((await (await get(`/template-import/sources?${targetQuery}&sourceComplectId=${ids.ownComplect}`)).json() as { complects: unknown[] }).complects, []);
  assert.equal((await get(`/get-changeable-values?ids=${ids.own}&rowName=goals&${targetQuery}`)).status, 403);
  assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.own, targetTemplateId: ids.target })).status, 403);

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
  assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target })).status, 403);
  assert.equal((await get(`/template-import/catalog?${targetQuery}`)).status, 403);
  assert.deepEqual((await pool.query(`SELECT ${protectedColumns} FROM rpd_profile_templates WHERE id=$1`, [ids.target])).rows[0], after);
  await pool.query("DELETE FROM user_complect WHERE user_id=$1 AND complect_id=$2", [ids.rop, ids.targetComplect]);
  assert.equal((await post("/template-import/complect", bulkBody, rop)).status, 403, "отзыв владельца цели проверяется до записи");
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'in_progress')",
    [ids.targetAssignment, ids.teacher, ids.target]);
  await pool.query("UPDATE users SET is_active=false WHERE id=$1", [ids.teacher]);
  assert.equal((await post("/copy-template-content", { sourceTemplateId: ids.foreign, targetTemplateId: ids.target })).status, 403);
  assert.deepEqual((await pool.query(`SELECT ${protectedColumns} FROM rpd_profile_templates WHERE id=$1`, [ids.target])).rows[0], after);
});
