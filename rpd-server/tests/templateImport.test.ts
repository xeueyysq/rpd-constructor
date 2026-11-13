import test from "node:test";
import assert from "node:assert/strict";
import TemplateImport from "../app/services/TemplateImport.ts";
import TemplateAccess from "../app/services/TemplateAccess.ts";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";
import { admin, profile, rop, teacher, templateDatabase } from "./helpers/templateImportDatabase.ts";

function addPair(db: ReturnType<typeof templateDatabase>, name = "Базы данных") {
  db.state.profiles.push({ ...profile(11, 1), disciplins_name: name }, { ...profile(21, 2), disciplins_name: name });
  db.state.exchange.push({ ...db.state.exchange[0], id: 101, discipline: name }, { ...db.state.exchange[1], id: 201, discipline: name });
  db.state.statuses.push({ id: 3, id_profile_template: 11, id_1c_template: 101, current_status: "created", history: [] }, { id: 4, id_profile_template: 21, id_1c_template: 201, current_status: "created", history: [] });
}

test("импорт из другого комплекта того же года доступен назначенному преподавателю/владельцу/admin", async () => {
  const db = templateDatabase();
  db.state.assignments.push({ user_id: teacher.id, template_id: 10, state: "assigned", updated_at: "2026-11-04" });
  const imports = new TemplateImport(db.db);
  for (const actor of [teacher, rop, admin]) {
    const catalog = await imports.sources(actor, 20, undefined);
    assert.equal(typeof catalog.targetRevision, "string");
    const preview = await imports.preview(actor, [10], "goals", 20);
    assert.deepEqual(preview, [{ id: 10, public_id: "rpd-10", goals: "Цель 10" }]);
  }
  await TemplateAccess.assertTemplate(db.db, teacher, 10, "read");
  assert.equal((await new RpdProfileTemplates(db.db).getChangeableValues([10], "goals", teacher)).length, 1);
  await assert.rejects(imports.sources(teacher, undefined, 2), { status: 403 });
  await assert.rejects(imports.sources({ ...teacher, role: 0 }, 20, undefined), { status: 403 });
  db.state.users.find((u) => u.id === teacher.id)!.is_active = false;
  await assert.rejects(imports.sources(teacher, 20, undefined), { status: 403 });
});

test("преподаватель не видит и не копирует чужой источник, а отзыв назначения закрывает уже выбранный", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  const initial = await imports.sources(teacher, 20, undefined);
  assert.deepEqual(initial.complects, []);
  await assert.rejects(imports.preview(teacher, [10], "goals", 20), { status: 403 });
  await assert.rejects(imports.copy(teacher, 10, 20, { field: "goals", baseAt: null }), { status: 403 });
  db.state.assignments.push({ user_id: teacher.id, template_id: 10, state: "done", updated_at: "2026-11-04" });
  assert.equal((await imports.sources(teacher, 20, undefined)).complects[0].templates[0].id, 10);
  db.state.assignments.pop();
  await assert.rejects(imports.copy(teacher, 10, 20), { status: 403 });
});

test("ownOnly сужает источники РОП, но false не раскрывает чужие преподавателю", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  assert.deepEqual((await imports.sources(rop, 20, undefined, true)).complects, []);
  assert.equal((await imports.sources(rop, 20, undefined, false)).complects[0].templates[0].id, 10);
  await assert.rejects(imports.preview(rop, [10], "goals", 20, true), { status: 403 });
  await assert.rejects(imports.copy(rop, 10, 20, { ownOnly: true }), { status: 403 });
  await assert.rejects(imports.preview(teacher, [10], "goals", 20, false), { status: 403 });
  await assert.rejects(imports.sources(rop, 20, undefined, "yes"), { status: 422 });
});

test("каталог форматирует ALLCAPS только для отображения, сохраняя исходные имена и смешанный регистр", async () => {
  const db = templateDatabase();
  db.state.profiles[0].disciplins_name = "  ИМПОРТ ПОЛЯ LIST3  ";
  db.state.profiles.push(
    { ...profile(11, 1), disciplins_name: "Java и SQL" },
    { ...profile(12, 1), disciplins_name: null },
  );
  const before = structuredClone(db.state);

  const catalog = await new TemplateImport(db.db).sources(rop, undefined, 2);

  assert.deepEqual(catalog.complects[0].templates.map((row) => row.disciplins_name), ["  Импорт поля list3  ", "Java и SQL", null]);
  assert.deepEqual(db.state, before, "Отображение каталога не меняет исходные данные для импорта/сопоставления");
});

test("каталог требует ровно одну авторизованную цель; закрытая цель и чужой комплект запрещены", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  for (const targets of [[undefined, undefined], [20, 2]]) await assert.rejects(imports.sources(rop, ...targets as [unknown, unknown]), { status: 422 });
  await assert.rejects(imports.sources(rop, 10, undefined), { status: 403 });
  await assert.rejects(imports.sources(rop, undefined, 1), { status: 403 });
  await assert.rejects(imports.copy(rop, 20, 10, { field: "goals", baseAt: null }), { status: 403 });
  db.state.statuses[1].current_status = "ready";
  await assert.rejects(imports.sources(teacher, 20, undefined), { status: 409 });
  await assert.rejects(imports.copy(teacher, 10, 20), { status: 409 });
});

test("полевой импорт заменяет текст и пустое значение, повтор не дописывает; возвращает edit и ловит stale baseAt", async () => {
  const db = templateDatabase();
  db.state.assignments.push({ user_id: teacher.id, template_id: 10, state: "done", updated_at: "2026-11-04" });
  const imports = new TemplateImport(db.db);
  const first = await imports.copy(teacher, 10, 20, { field: "goals", baseAt: null });
  assert.equal(first.value, "Цель 10");
  assert.equal(first.edit?.userId, teacher.id);
  const second = await imports.copy(teacher, 10, 20, { field: "goals", baseAt: first.edit!.at });
  assert.equal(second.value, "Цель 10");
  const before = structuredClone(db.state);
  await assert.rejects(imports.copy(teacher, 10, 20, { field: "goals", baseAt: first.edit!.at }), { status: 409 });
  assert.deepEqual(db.state, before);
  db.state.profiles[0].goals = "";
  assert.equal((await imports.copy(rop, 10, 20, { field: "goals", baseAt: second.edit!.at })).value, "");
});

test("whitelist не позволяет импортировать компетенции, оба ФОС или метаданные, в том числе через preview", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  const before = structuredClone(db.state);
  for (const field of ["competencies", "assessment_tools_questions", "assessment_tools_template", "semester", "study_load", "field_edits"]) {
    await assert.rejects(imports.copy(teacher, 10, 20, { field, baseAt: null }), { status: 422 });
    await assert.rejects(imports.preview(teacher, [10], field, 20), { status: 422 });
  }
  await assert.rejects(imports.copy(teacher, 10, 20, { field: "goals" }), { status: 422 });
  await assert.rejects(imports.copy(teacher, 20, 20, { field: "goals", baseAt: null }), { status: 422 });
  db.state.profiles.push(profile(21, 2));
  await assert.rejects(imports.copy(teacher, 21, 20), { status: 422 });
  assert.deepEqual(db.state.profiles.slice(0, 2), before.profiles);
});

test("полный импорт заменяет содержание и литературу; защищённые поля, состояние, участники и учебный план сохранены", async () => {
  const db = templateDatabase();
  db.state.assignments.push({ user_id: teacher.id, template_id: 10, state: "assigned", updated_at: "2026-11-04" });
  const imports = new TemplateImport(db.db);
  const before = structuredClone(db.state);
  const revision = (await imports.sources(teacher, 20, undefined)).targetRevision;
  const result = await imports.copy(teacher, 10, 20, { targetRevision: revision });
  const target = db.state.profiles[1];
  assert.equal(target.goals, "Цель 10");
  assert.deepEqual(target.content, before.profiles[0].content);
  assert.deepEqual(target.textbook, ["Книга 10"]);
  assert.deepEqual(target.additional_textbook, ["Доп. книга 10"]);
  for (const field of ["id", "public_id", "id_rpd_complect", "disciplins_name", "department", "place", "semester", "certification", "zet", "study_load", "control_load", "competencies", "assessment_tools_questions", "assessment_tools_template"]) assert.deepEqual(target[field], before.profiles[1][field], field);
  assert.deepEqual(db.state.statuses, before.statuses);
  assert.deepEqual(db.state.assignments, before.assignments);
  assert.notEqual(result.targetRevision, revision);
  const after = structuredClone(db.state);
  await assert.rejects(imports.copy(teacher, 10, 20, { targetRevision: revision }), { status: 409 });
  assert.deepEqual(db.state, after);
  // Старый full-copy клиент без revision сохраняет совместимость.
  assert.equal((await imports.copy(teacher, 10, 20)).success, true);
});

test("bulk требует manager цели и baseline; одинаковый комплект запрещён", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  await assert.rejects(imports.complect(teacher, 1, 2, "baseline"), { status: 403 });
  await assert.rejects(imports.complect(rop, 2, 1, "baseline"), { status: 403 });
  await assert.rejects(imports.complect(rop, 2, 2, "baseline"), { status: 422 });
  await assert.rejects(imports.complect(rop, 1, 2, undefined), { status: 422 });
  const revision = (await imports.sources(rop, undefined, 2)).targetRevision;
  db.state.profiles[1].field_edits.goals = { userId: 8, at: "2026-11-04T01:00:00Z" };
  const before = structuredClone(db.state);
  await assert.rejects(imports.complect(rop, 1, 2, revision), { status: 409 });
  assert.deepEqual(db.state, before);
});

test("bulk: имя нормализуется; semester и record_type строго совпадают, NULL semester не расширяется", async (t) => {
  for (const [sourceSemester, targetSemester, sourceType, targetType, expected] of [
    [1, 1, "1.О", "1.О", 1], [2, 1, "1.О", "1.О", 0], [null, 1, "1.О", "1.О", 0],
    [null, null, "1.О", "1.О", 1], [1, 1, "1.В", "1.О", 0], [1, 1, null, "1.О", 0], [1, 1, null, null, 1],
  ] as const) await t.test(JSON.stringify([sourceSemester, targetSemester, sourceType, targetType]), async () => {
    const db = templateDatabase();
    db.state.exchange[0].semester = sourceSemester;
    db.state.exchange[1].semester = targetSemester;
    db.state.exchange[0].record_type = sourceType;
    db.state.exchange[1].record_type = targetType;
    const imports = new TemplateImport(db.db);
    const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
    const result = await imports.complect(rop, 1, 2, baseline);
    assert.deepEqual(result.counts, { total: 1, imported: expected, skipped: 1 - expected });
    assert.equal(db.state.profiles[1].goals, expected ? "Цель 10" : "Цель 20");
    if (!expected) assert.equal(result.skipped[0].reason, "missing_source");
  });
});

test("bulk пропускает неоднозначные, отсутствующие и закрытые связи с причиной", async (t) => {
  for (const kind of ["source_duplicate", "target_duplicate", "source_missing_template", "target_missing_template", "read_only"] as const) await t.test(kind, async () => {
    const db = templateDatabase();
    if (kind === "source_duplicate") {
      db.state.profiles.push(profile(11, 1));
      db.state.exchange.push({ ...db.state.exchange[0], id: 101 });
      db.state.statuses.push({ ...db.state.statuses[0], id: 3, id_profile_template: 11, id_1c_template: 101 });
    } else if (kind === "target_duplicate") {
      db.state.profiles.push(profile(21, 2));
      db.state.exchange.push({ ...db.state.exchange[1], id: 201 });
      db.state.statuses.push({ ...db.state.statuses[1], id: 3, id_profile_template: 21, id_1c_template: 201 });
    } else if (kind === "source_missing_template") db.state.statuses.shift();
    else if (kind === "target_missing_template") db.state.statuses.pop();
    else db.state.statuses[1].current_status = "ready";
    const imports = new TemplateImport(db.db);
    const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
    const before = structuredClone(db.state);
    const result = await imports.complect(rop, 1, 2, baseline);
    assert.equal(result.counts.imported, 0);
    assert.ok(result.skipped.every((entry) => entry.reason === (kind.endsWith("duplicate") ? "ambiguous" : kind)));
    assert.deepEqual(db.state, before);
  });
});

test("bulk копирует допустимые пары одной транзакцией; неожиданная ошибка второй записи откатывает первую", async () => {
  const db = templateDatabase();
  // Две одноимённые дисциплины одного семестра различаются record_type.
  addPair(db, "Программирование");
  db.state.exchange.find((e) => e.id === 101)!.record_type = "1.В";
  db.state.exchange.find((e) => e.id === 201)!.record_type = "1.В";
  const imports = new TemplateImport(db.db);
  const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
  const before = structuredClone(db.state);
  db.failWriteAt(2);
  await assert.rejects(imports.complect(rop, 1, 2, baseline), /synthetic write failure/);
  assert.deepEqual(db.state, before);
  db.failWriteAt(Infinity);
  const result = await imports.complect(rop, 1, 2, baseline);
  assert.deepEqual(result.counts, { total: 2, imported: 2, skipped: 0 });
  assert.equal(db.state.profiles.find((p) => p.id === 21)?.goals, "Цель 11");
  assert.deepEqual(db.state.profiles[1].competencies, before.profiles[1].competencies);
  assert.equal(db.state.profiles[1].assessment_tools_template, "ФОС 20");
  assert.deepEqual(db.state.assignments, before.assignments);
  assert.deepEqual(db.state.statuses, before.statuses);
});

test("bulk возвращает общий итог для импортированной и пропущенной пары, сохраняя пропущенную цель", async () => {
  const db = templateDatabase();
  addPair(db);
  db.state.statuses = db.state.statuses.filter((s) => s.id_profile_template !== 11);
  const imports = new TemplateImport(db.db);
  const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
  const result = await imports.complect(rop, 1, 2, baseline);
  assert.deepEqual(result.counts, { total: 2, imported: 1, skipped: 1 });
  assert.equal(result.imported[0].targetTemplateId, 20);
  assert.equal(result.skipped[0].targetTemplateId, 21);
  assert.equal(result.skipped[0].reason, "source_missing_template");
  assert.equal(db.state.profiles.find((p) => p.id === 21)?.goals, "Цель 21");
});
