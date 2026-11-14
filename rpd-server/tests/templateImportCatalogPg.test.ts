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

test("PostgreSQL: плоские страницы, владельцы, уровень цели и режимы полевого каталога", { skip: !enabled }, async (t) => {
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
  const sibling = base + 26;
  const secondRop = base + 2;
  await pool.query("INSERT INTO users(id,name,password,role,fullname) VALUES($1,$2,'no-login',2,'{}'::jsonb),($3,$4,'no-login',3,'{}'::jsonb)",
    [teacherId, `cat-t-${nonce}`, ropId, `cat-r-${nonce}`]);
  await pool.query("UPDATE users SET fullname=$1::jsonb WHERE id=$2", [JSON.stringify({ surname: "Иванов", name: "Иван", patronymic: "Иванович" }), ropId]);
  await pool.query("INSERT INTO users(id,name,password,role,fullname) VALUES($1,$2,'no-login',3,$3::jsonb)",
    [secondRop, `cat-r2-${nonce}`, JSON.stringify({ surname: "Петров", name: "Пётр" })]);
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$9,2026,'Очная','Бакалавриат','Цель','09.03.01'),
      ($3,$4,$9,2026,'Очная','Бакалавриат','Профиль А','09.03.02'),
      ($5,$6,$10,2025,'Заочная','Магистратура','Профиль Б','09.04.01'),
      ($7,$8,$9,2024,'Очная','Бакалавриат','Чужой профиль','09.03.03')`,
    [targetComplect, randomUUID(), sameYear, randomUUID(), older, randomUUID(), foreign, randomUUID(), `Факультет ${nonce}`, `Чужой ${nonce}`]);
  await pool.query(`INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,field_edits)
    VALUES($1,$2,$3,' Архитектура   систем ', '{}'::jsonb),
      ($4,$5,$6,'АРХИТЕКТУРА СИСТЕМ','{}'::jsonb),
      ($7,$8,$9,'Алгоритмы','{}'::jsonb),
      ($10,$11,$12,'Чужая дисциплина','{}'::jsonb)`,
    [target, randomBytes(6).toString("hex"), targetComplect, matching, randomBytes(6).toString("hex"), sameYear,
      ownOther, randomBytes(6).toString("hex"), older, foreignTemplate, randomBytes(6).toString("hex"), foreign]);
  await pool.query(`INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,field_edits)
    VALUES($1,$2,$3,E'\tАРХИТЕКТУРА СИСТЕМ\t','{}'::jsonb)`, [sibling, randomBytes(6).toString("hex"), sameYear]);
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'in_progress'),($4,$2,$5,'done'),($6,$2,$7,'assigned')",
    [base + 30, teacherId, target, base + 31, matching, base + 32, ownOther]);
  await pool.query("INSERT INTO user_complect(id,user_id,complect_id) VALUES($1,$2,$3),($4,$2,$5),($6,$7,$5)",
    [base + 40, ropId, targetComplect, base + 41, sameYear, base + 42, secondRop]);
  await pool.query("INSERT INTO template_status(id,id_profile_template,current_status) VALUES($1,$2,'ready')",
    [base + 50, matching]);
  const service = new TemplateImport(pool);
  const teacher = { id: teacherId, role: USER_ROLES.TEACHER, userName: `cat-t-${nonce}` };
  const rop = { id: ropId, role: USER_ROLES.ROP, userName: `cat-r-${nonce}` };
  const context = { targetTemplateId: String(target), faculty: `Факультет ${nonce}`, page: "1", pageSize: "1" };
  const page = await service.catalog(teacher, context);
  assert.equal(page.pageSize, 1);
  assert.equal(page.scope, "single", "отсутствующий scope совместим с типом цели");
  assert.equal(page.total, 3, "считаются дисциплины, а не два комплекта или назначения РОП");
  assert.deepEqual(page.complects, []);
  assert.equal(page.templates[0].id, matching);
  assert.equal(page.templates[0].complect.id, sameYear);
  assert.deepEqual(page.templates[0].complect.owners, [
    { userId: ropId, fullname: "Иванов Иван Иванович" }, { userId: secondRop, fullname: "Петров Пётр" },
  ]);
  assert.ok(page.facets.faculties.includes(`Факультет ${nonce}`));
  assert.ok(!page.facets.faculties.includes(`Чужой ${nonce}`), "другой уровень исключён ещё до фасетов");
  assert.deepEqual(page.facets.educationLevels, ["Бакалавриат"]);
  assert.equal(page.targetEducationLevel, "Бакалавриат");
  const narrowed = await service.catalog(teacher, { ...context, faculty: `Факультет ${nonce}`,
    educationLevel: "Бакалавриат", direction: "09.03.02" });
  assert.ok(narrowed.facets.faculties.includes(`Факультет ${nonce}`));
  assert.deepEqual(narrowed.facets.directions, ["09.03.02", "09.03.03"]);
  assert.deepEqual(narrowed.facets.profiles, ["Профиль А"]);
  assert.deepEqual(narrowed.facets.educationForms, ["Очная"]);
  assert.deepEqual(narrowed.facets.years, [2026]);
  const second = await service.catalog(teacher, { ...context, page: "2" });
  assert.equal(second.templates[0].id, sibling, "вторая страница остаётся в том же комплекте");
  assert.equal((await service.catalog(teacher, { ...context, page: "3" })).templates[0].id, foreignTemplate);
  assert.deepEqual((await service.catalog(teacher, { ...context, status: "ready" })).templates.map((row) => row.id), [matching]);
  assert.equal((await service.catalog(teacher, { ...context, search: "Алгоритмы" })).total, 0);
  assert.equal((await service.catalog(teacher, { ...context, search: "Чужая дисциплина", ownOnly: "true" })).templates[0].id, foreignTemplate);
  assert.equal((await service.catalog(teacher, { ...context, search: "%_" })).total, 0, "шаблонные символы поиска буквальны");
  const fieldContext = { ...context, scope: "field", ownOnly: "false", sameNameOnly: "false" };
  assert.equal((await service.catalog(teacher, fieldContext)).total, 1, "false не снимает назначение или совпадение имени");
  assert.equal((await service.catalog(rop, { ...fieldContext, ownOnly: "true" })).total, 0);
  assert.equal((await service.catalog(rop, fieldContext)).total, 2);
  assert.equal((await service.catalog(rop, { ...fieldContext, sourceMode: "other-year" })).total, 0,
    "другой год также исключает дисциплины с другим именем при sameNameOnly=false");
  assert.equal((await service.catalog(teacher, { ...fieldContext, sourceMode: "other-year" })).total, 0);
  assert.equal((await service.catalog(teacher, { ...context, sourceMode: "other-year" })).total, 3, "single игнорирует старый режим поля");
  const unknownSourceComplect = base + 14;
  const unknownTargetComplect = base + 15;
  const unknownSource = base + 24;
  const unknownTarget = base + 25;
  await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,year,education_form,education_level,profile,direction)
    VALUES($1,$2,$5,NULL,'Очная','Бакалавриат','Без года источник','09.03.04'),
      ($3,$4,$5,NULL,'Очная','Бакалавриат','Без года цель','09.03.05')`,
    [unknownSourceComplect, randomUUID(), unknownTargetComplect, randomUUID(), `Факультет ${nonce}`]);
  await pool.query(`INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,field_edits)
    VALUES($1,$2,$3,'архитектура систем','{}'::jsonb),($4,$5,$6,'Архитектура систем','{}'::jsonb)`,
    [unknownSource, randomBytes(6).toString("hex"), unknownSourceComplect,
      unknownTarget, randomBytes(6).toString("hex"), unknownTargetComplect]);
  await pool.query("INSERT INTO teacher_templates(id,user_id,template_id,state) VALUES($1,$2,$3,'assigned'),($4,$2,$5,'assigned')",
    [base + 33, teacherId, unknownSource, base + 34, unknownTarget]);
  assert.equal((await service.catalog(teacher, { ...fieldContext, sourceMode: "other-year" })).total, 0,
    "источник без года не считается другим годом");
  assert.equal((await service.catalog(teacher, { ...fieldContext, targetTemplateId: String(unknownTarget), sourceMode: "other-year" })).total, 0,
    "цель без года не включает все известные источники");
  assert.equal((await service.catalog(teacher, { ...fieldContext, profile: "Без года источник" })).total, 1,
    "источник без года доступен в обычном выборе другого комплекта");
  await pool.query("UPDATE rpd_complects SET year=2023 WHERE id=$1", [unknownSourceComplect]);
  assert.equal((await service.catalog(teacher, { ...fieldContext, sourceMode: "other-year" })).total, 0,
    "разные годы и имя не разрешают источник другой программы");
  assert.deepEqual((await service.sources(teacher, target, undefined, undefined,
    { ...context, sourceComplectId: String(sameYear), status: "ready" })).complects[0].templates.map((item) => item.id), [matching]);
  assert.deepEqual((await service.sources(teacher, target, undefined, undefined,
    { ...context, sourceComplectId: String(older), status: "ready" })).complects, []);
  assert.equal((await service.catalog(rop, { ...context, ownOnly: "true" })).total, 5, "single игнорирует ownOnly даже для РОП");
  for (const scope of ["single", "field", "bulk"]) {
    const targetQuery = scope === "bulk" ? { targetComplectId: String(targetComplect) } : { targetTemplateId: String(target) };
    for (const status of ["unsupported", "created", ["ready"]])
      await assert.rejects(service.catalog(rop, { ...targetQuery, scope, status }), { status: 422 });
  }
  for (const query of [{ ...context, scope: "bulk" }, { targetComplectId: String(targetComplect), scope: "field" }, { ...context, scope: "invalid" }])
    await assert.rejects(service.catalog(rop, query), { status: 422 });
  await assert.rejects(service.catalog(teacher, { ...context, educationLevel: "Магистратура" }), { status: 422 });
  await assert.rejects(service.catalog(teacher, { ...context, pageSize: "26" }), { status: 422 });
  await pool.query("DELETE FROM teacher_templates WHERE template_id=$1 AND user_id=$2", [matching, teacherId]);
  assert.equal((await service.catalog(teacher, { ...fieldContext, profile: "Профиль А" })).total, 0);
  assert.equal((await service.catalog(teacher, { ...context, profile: "Профиль А" })).total, 2);
  assert.deepEqual((await service.sources(teacher, target, undefined, undefined,
    { ...fieldContext, sourceComplectId: String(sameYear) })).complects, []);
  await pool.query("UPDATE rpd_complects SET education_level=NULL WHERE id=ANY($1::int[])", [[unknownTargetComplect, unknownSourceComplect]]);
  const unknownLevel = await service.catalog(teacher, { ...context, targetTemplateId: String(unknownTarget) });
  assert.equal(unknownLevel.targetEducationLevel, null);
  assert.equal(unknownLevel.total, 1, "NULL уровня сравнивается с NULL, не со всеми уровнями");
  assert.deepEqual(unknownLevel.templates.map((row) => row.id), [unknownSource]);
  assert.deepEqual(unknownLevel.facets.educationLevels, []);
  assert.deepEqual(unknownLevel.facets.directions, ["09.03.04"]);
});

test("PostgreSQL: другой год — точная программа, NULL, имя и назначение до списка, фасетов и details", { skip: !enabled }, async (t) => {
  const pool = new Pool({ connectionString, max: 2 });
  const base = randomInt(500_000_000, 900_000_000);
  const nonce = randomBytes(6).toString("hex");
  const teacherId = base;
  const complectIds: number[] = [];
  const templateIds: number[] = [];
  t.after(async () => {
    try {
      await pool.query("DELETE FROM rpd_complects WHERE id=ANY($1::int[])", [complectIds]);
      await pool.query("DELETE FROM users WHERE id=$1", [teacherId]);
    } finally { await pool.end(); }
  });
  await pool.query("INSERT INTO users(id,name,password,role,fullname) VALUES($1,$2,'no-login',2,'{}'::jsonb)", [teacherId, `ly-${nonce}`]);
  const actor = { id: teacherId, role: USER_ROLES.TEACHER, userName: `ly-${nonce}` };
  const program = { faculty: `Институт ${nonce}`, direction: "09.03.01", profile: "Точная программа", education_form: "Очная", education_level: "Бакалавриат" };
  type Program = { [K in keyof typeof program]: string | null };
  const name = `Архитектура ${nonce} систем`;
  const add = async (year: number | null, attributes: Program, discipline: string | null = name, assigned = true) => {
    const complectId = base + 10 + complectIds.length;
    const templateId = base + 100 + templateIds.length;
    complectIds.push(complectId);
    templateIds.push(templateId);
    await pool.query(`INSERT INTO rpd_complects(id,uuid,faculty,direction,profile,education_form,education_level,year)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [complectId, randomUUID(), attributes.faculty, attributes.direction,
      attributes.profile, attributes.education_form, attributes.education_level, year]);
    await pool.query("INSERT INTO rpd_profile_templates(id,public_id,id_rpd_complect,disciplins_name,semester) VALUES($1,$2,$3,$4,99)",
      [templateId, randomBytes(6).toString("hex"), complectId, discipline]);
    if (assigned) await pool.query("INSERT INTO teacher_templates(user_id,template_id,state) VALUES($1,$2,'assigned')", [teacherId, templateId]);
    return { complectId, templateId };
  };
  const target = await add(2026, program);
  const positive = await add(2025, program, `\t АРХИТЕКТУРА   ${nonce.toUpperCase()} СИСТЕМ \t`);
  await pool.query("UPDATE rpd_profile_templates SET semester=1 WHERE id=$1", [target.templateId]);
  await pool.query(`INSERT INTO rpd_1c_exchange(id,id_rpd_complect,discipline,semester,record_type)
    VALUES($1,$2,$3,9,'practice')`, [base + 200, positive.complectId, name]);
  await pool.query("INSERT INTO template_status(id,id_1c_template,id_profile_template,current_status) VALUES($1,$2,$3,'created')",
    [base + 300, base + 200, positive.templateId]);
  const negatives: Array<{ complectId: number; templateId: number }> = [];
  for (const attribute of Object.keys(program) as Array<keyof Program>) {
    // Каждый источник отличается ровно одним атрибутом. Пробел значим и не нормализуется.
    negatives.push(await add(2025, { ...program, [attribute]: `${program[attribute]} ` }));
  }
  const noYear = await add(null, program);
  const differentName = await add(2024, program, `Другое имя ${nonce}`);
  const emptyName = await add(2023, program, " \t ");
  const nullName = await add(2022, program, null);
  const unassigned = await add(2021, program, name, false);
  negatives.push(noYear, differentName, emptyName, nullName, unassigned);
  const service = new TemplateImport(pool);
  const query = { targetTemplateId: String(target.templateId), scope: "field", sourceMode: "other-year", ownOnly: "false", sameNameOnly: "false" };
  const page = await service.catalog(actor, query);
  assert.equal(page.total, 1);
  assert.deepEqual(page.templates.map((row) => row.id), [positive.templateId], "Семестр и тип записи не ограничивают полевой каталог");
  assert.deepEqual(page.facets, { faculties: [program.faculty], educationLevels: [program.education_level],
    directions: [program.direction], profiles: [program.profile], educationForms: [program.education_form], years: [2025] });
  const details = await service.sources(actor, target.templateId, undefined, "false", { ...query, sourceComplectId: String(positive.complectId) });
  assert.deepEqual(details.complects.flatMap((c) => c.templates.map((item) => item.id)), [positive.templateId]);
  assert.equal((await service.catalog(actor, { ...query, page: "2", pageSize: "1" })).templates.length, 0);
  for (const excluded of negatives) {
    const detail = await service.sources(actor, target.templateId, undefined, "false", { ...query, sourceComplectId: String(excluded.complectId) });
    assert.deepEqual(detail.complects, [], `Исключённый комплект ${excluded.complectId} не возвращается через details`);
  }
  assert.ok((await service.catalog(actor, { ...query, sourceMode: "other-complect", pageSize: "25" })).templates.some((row) => row.id === negatives[0].templateId),
    "Обычный другой комплект сохраняет доступ к чужой программе");
  await pool.query("DELETE FROM teacher_templates WHERE template_id=$1 AND user_id=$2", [positive.templateId, teacherId]);
  const revoked = await service.catalog(actor, query);
  assert.equal(revoked.total, 0);
  assert.deepEqual(revoked.facets.years, []);
  assert.deepEqual((await service.sources(actor, target.templateId, undefined, "false", query)).complects, []);

  // NULL сравнивается точно: nullable business key допускает и отдельный комплект того же года.
  const nullable: Program = { faculty: null, direction: null, profile: null, education_form: null, education_level: null };
  const nullableTarget = await add(2026, nullable);
  const nullableSource = await add(2025, nullable);
  const sameYear = await add(2026, nullable);
  const nullableNoYear = await add(null, nullable);
  const partialNullMismatches = [];
  for (const attribute of Object.keys(program) as Array<keyof Program>) {
    partialNullMismatches.push(await add(2025, { ...nullable, [attribute]: program[attribute] }));
  }
  const nullQuery = { ...query, targetTemplateId: String(nullableTarget.templateId) };
  const nullPage = await service.catalog(actor, nullQuery);
  assert.equal(nullPage.total, 1, "NULL совпадает только с NULL по каждому из пяти атрибутов");
  assert.deepEqual(nullPage.templates.map((row) => row.id), [nullableSource.templateId]);
  assert.deepEqual(nullPage.facets, { faculties: [], educationLevels: [], directions: [], profiles: [], educationForms: [], years: [2025] });
  for (const excluded of [sameYear, nullableNoYear, ...partialNullMismatches]) {
    assert.deepEqual((await service.sources(actor, nullableTarget.templateId, undefined, "false",
      { ...nullQuery, sourceComplectId: String(excluded.complectId) })).complects, []);
  }
  await pool.query("UPDATE rpd_complects SET year=NULL WHERE id=$1", [nullableTarget.complectId]);
  assert.equal((await service.catalog(actor, nullQuery)).total, 0, "Неизвестный год цели исключает other-year");
  await pool.query("UPDATE rpd_complects SET year=2026 WHERE id=$1", [nullableTarget.complectId]);
  await pool.query("UPDATE rpd_profile_templates SET disciplins_name=NULL WHERE id=$1", [nullableTarget.templateId]);
  assert.equal((await service.catalog(actor, nullQuery)).total, 0, "NULL имени цели не совпадает с источниками");
});
