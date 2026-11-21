import test from "node:test";
import assert from "node:assert/strict";
import TemplateImport from "../app/services/TemplateImport.ts";
import TemplateAccess from "../app/services/TemplateAccess.ts";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";
import type { TemplateImportField } from "../app/modules/templateImport.ts";
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

test("полевой импорт преподавателя требует назначение, включая отзыв уже выбранного источника", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  const initial = await imports.sources(teacher, 20, undefined, undefined, { scope: "field" });
  assert.deepEqual(initial.complects, []);
  await assert.rejects(imports.preview(teacher, [10], "goals", 20), { status: 403 });
  await assert.rejects(imports.copy(teacher, 10, 20, { field: "goals", baseAt: null }), { status: 403 });
  db.state.assignments.push({ user_id: teacher.id, template_id: 10, state: "done", updated_at: "2026-11-04" });
  assert.equal((await imports.sources(teacher, 20, undefined, undefined, { scope: "field" })).complects[0].templates[0].id, 10);
  db.state.assignments.pop();
  await assert.rejects(imports.copy(teacher, 10, 20, { field: "goals", baseAt: null }), { status: 403 });
});

test("ownOnly сужает источники РОП, но false не раскрывает чужие преподавателю", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  for (const scope of ["field", "single"] as const) {
    const options = scope === "field" ? { field: "goals", baseAt: null } : {};
    assert.deepEqual((await imports.sources(rop, 20, undefined, true, { scope })).complects, []);
    assert.equal((await imports.sources(rop, 20, undefined, false, { scope })).complects[0].templates[0].id, 10);
    await assert.rejects(imports.copy(rop, 10, 20, { ...options, ownOnly: true }), { status: 403 });
    for (const ownOnly of [undefined, false, true]) {
      assert.deepEqual((await imports.sources(teacher, 20, undefined, ownOnly, { scope })).complects, []);
      await assert.rejects(imports.copy(teacher, 10, 20, { ...options, ownOnly }), { status: 403 });
    }
  }
  await assert.rejects(imports.preview(rop, [10], "goals", 20, true), { status: 403 });
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

  const catalog = await new TemplateImport(db.db).sources(rop, 20, undefined);

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
  await assert.rejects(imports.copy(rop, 21, 20), { status: 422 });
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

test("bulk: имя и семестр определяют пару без кода, перенос требует известных семестров", async (t) => {
  for (const [sourceSemester, targetSemester, sourceType, targetType, expected] of [
    [1, 1, "1.О", "1.О", 1], [2, 1, "1.О", "1.О", 1], [1, 2, "1.О", "1.О", 1],
    [null, 1, "1.О", "1.О", 0], [1, null, "1.О", "1.О", 0], [1, 2, "1.В", "1.О", 1],
    [null, null, "1.О", "1.О", 1], [1, 1, "1.В", "1.О", 1], [1, 1, null, "1.О", 1], [1, 1, null, null, 1],
    [0, 1, "1.О", "1.О", 0], [1, 0, "1.О", "1.О", 0], [0, 0, "1.О", "1.О", 1],
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

test("bulk копирует допустимые пары одной транзакцией; неожиданная ошибка второй записи откатывает первую", async (t) => {
  for (const mode of ["replace", "append"] as const) await t.test(mode, async () => {
    const db = templateDatabase();
    // Одна пара точная, другая перенесена и отличается record_type.
    addPair(db, "Программирование");
    db.state.exchange.find((e) => e.id === 101)!.record_type = "1.В";
    db.state.exchange.find((e) => e.id === 101)!.semester = 2;
    db.state.exchange.find((e) => e.id === 201)!.record_type = "1.В";
    db.state.exchange.find((e) => e.id === 201)!.semester = 3;
    const imports = new TemplateImport(db.db);
    const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
    const before = structuredClone(db.state);
    db.failWriteAt(2);
    await assert.rejects(imports.complect(rop, 1, 2, baseline, undefined, mode), /synthetic write failure/);
    assert.deepEqual(db.state, before);
    db.failWriteAt(Infinity);
    const result = await imports.complect(rop, 1, 2, baseline, undefined, mode);
    assert.deepEqual(result.counts, { total: 2, imported: 2, skipped: 0 });
    assert.equal(db.state.profiles.find((p) => p.id === 21)?.goals, mode === "append" ? "Цель 21<br/><br/>Цель 11" : "Цель 11");
    assert.deepEqual(db.state.profiles[1].competencies, before.profiles[1].competencies);
    assert.equal(db.state.profiles[1].assessment_tools_template, "ФОС 20");
    assert.deepEqual(db.state.assignments, before.assignments);
    assert.deepEqual(db.state.statuses, before.statuses);
  });
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

test("bulk резервирует все точные связи до переноса и не угадывает неоднозначные остатки", async (t) => {
  type Case = { name: string; sources: Array<number | null>; targets: Array<number | null>;
    unavailable?: "ready" | "closed" | "missing"; sourceMissing?: boolean;
    pairs: number[][]; reasons: Array<string | null> };
  const cases: Case[] = [
    { name: "точная пара и перенос остатка", sources: [1, 2], targets: [2, 3], pairs: [[20, 11], [21, 10]], reasons: [null, null] },
    { name: "точный источник не используется ранней целью повторно", sources: [1], targets: [2, 1], pairs: [[21, 10]], reasons: ["missing_source", null] },
    { name: "закрытая точная цель резервирует источник", sources: [1, 2], targets: [2, 3], unavailable: "closed", pairs: [[21, 10]], reasons: ["read_only", null] },
    { name: "готовая точная цель резервирует источник", sources: [1, 2], targets: [2, 3], unavailable: "ready", pairs: [[21, 10]], reasons: ["read_only", null] },
    { name: "несозданная точная цель резервирует источник", sources: [1, 2], targets: [2, 3], unavailable: "missing", pairs: [[21, 10]], reasons: ["target_missing_template", null] },
    { name: "неоднозначные точные источники зарезервированы", sources: [1, 2, 2], targets: [2, 3], pairs: [[21, 10]], reasons: ["ambiguous", null] },
    { name: "неоднозначные точные цели резервируют источник", sources: [1, 2], targets: [2, 2, 3], pairs: [[22, 10]], reasons: ["ambiguous", "ambiguous", null] },
    { name: "один источник на две перенесённые цели", sources: [1], targets: [2, 3], pairs: [], reasons: ["ambiguous", "ambiguous"] },
    { name: "два источника на перенесённую цель", sources: [1, 2], targets: [3], pairs: [], reasons: ["ambiguous"] },
    { name: "дубликаты источника другого семестра", sources: [1, 1], targets: [2], pairs: [], reasons: ["ambiguous"] },
    { name: "неизвестный семестр не делает известный источник уникальным", sources: [1, null], targets: [2], pairs: [], reasons: ["ambiguous"] },
    { name: "нулевой семестр не делает известный источник уникальным", sources: [1, 0], targets: [2], pairs: [], reasons: ["ambiguous"] },
    { name: "перенос в несозданную цель", sources: [1], targets: [2], unavailable: "missing", pairs: [], reasons: ["target_missing_template"] },
    { name: "перенос из несозданного источника", sources: [1], targets: [2], sourceMissing: true, pairs: [], reasons: ["source_missing_template"] },
    { name: "перенос в закрытую цель", sources: [1], targets: [2], unavailable: "closed", pairs: [], reasons: ["read_only"] },
  ];
  for (const row of cases) await t.test(row.name, async () => {
    const db = templateDatabase();
    db.state.profiles = [];
    db.state.exchange = [];
    db.state.statuses = [];
    for (const [side, semesters] of [row.sources, row.targets].entries()) {
      for (const [index, semester] of semesters.entries()) {
        const id = (side + 1) * 10 + index;
        const exchangeId = (side + 1) * 100 + index;
        db.state.profiles.push({ ...profile(id, side + 1), semester });
        db.state.exchange.push({ id: exchangeId, id_rpd_complect: side + 1,
          discipline: side ? "Программирование" : "  ПРОГРАММИРОВАНИЕ  ", semester, record_type: side ? "Б1.О.01" : `Б1.В.${index}`, removed_at: null });
        if (!(index === 0 && (side ? row.unavailable === "missing" : row.sourceMissing)))
          db.state.statuses.push({ id, id_profile_template: id, id_1c_template: exchangeId,
            current_status: side && index === 0 && row.unavailable ? row.unavailable : "created", history: [] });
      }
    }
    const before = structuredClone(db.state);
    const imports = new TemplateImport(db.db);
    const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
    const result = await imports.complect(rop, 1, 2, baseline);
    assert.deepEqual(result.imported.map((entry) => [entry.targetTemplateId, entry.sourceTemplateId]), row.pairs);
    assert.deepEqual(result.skipped.map((entry) => [entry.targetExchangeId - 200, entry.reason]),
      row.reasons.flatMap((reason, index) => reason ? [[index, reason]] : []));
    for (const target of db.state.profiles.filter((p) => p.id_rpd_complect === 2)) {
      const original = before.profiles.find((p) => p.id === target.id)!;
      const pair = row.pairs.find(([targetId]) => targetId === target.id);
      assert.equal(target.goals, `Цель ${pair ? pair[1] : target.id}`);
      assert.equal(target.semester, original.semester, "семестр учебного плана цели не копируется");
    }
    assert.deepEqual(db.state.exchange, before.exchange);
    assert.deepEqual(db.state.statuses, before.statuses);
  });
});

test("append во всех областях дополняет текст, массивы и legacy-строки, сохраняя пустые и защищённые данные", async (t) => {
  for (const scope of ["field", "single", "bulk"] as const) await t.test(scope, async () => {
    const db = templateDatabase();
    const source = db.state.profiles[0];
    const target = db.state.profiles[1];
    source.place_more_text = " \n ";
    source.software = null;
    source.additional_textbook = [];
    source.content_more_text = "";
    target.content = { "2": { theme: "Старая тема" }, "9": { theme: "Последняя тема" }, legacy: { theme: "Legacy цели" },
      future: { extension: true }, __attestation__: { theme: "Экзамен цели", control: 36 } };
    source.content = { "2": { theme: "Новая тема", lectures: 2 }, legacy: { theme: "Legacy источника", control: 1 },
      __attestation__: { theme: "Экзамен источника", control: 99 }, __meta__: { plan: true } };
    const before = structuredClone(db.state);
    const imports = new TemplateImport(db.db);
    const fields: TemplateImportField[] = ["goals", "textbook", "content", "place_more_text", "software", "additional_textbook", "content_more_text"];
    if (scope === "field") {
      for (const field of fields) await imports.copy(rop, 10, 20, { field, baseAt: null, mode: "append" });
    } else if (scope === "single") {
      const baseline = (await imports.sources(rop, 20, undefined)).targetRevision;
      await imports.copy(rop, 10, 20, { targetRevision: baseline, mode: "append" });
      const after = structuredClone(db.state);
      await assert.rejects(imports.copy(rop, 10, 20, { targetRevision: baseline, mode: "append" }), { status: 409 });
      assert.deepEqual(db.state, after);
    } else {
      const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
      await imports.complect(rop, 1, 2, baseline, undefined, "append");
      const after = structuredClone(db.state);
      await assert.rejects(imports.complect(rop, 1, 2, baseline, undefined, "append"), { status: 409 });
      assert.deepEqual(db.state, after);
    }
    const saved = db.state.profiles[1];
    assert.equal(saved.goals, "Цель 20<br/><br/>Цель 10");
    assert.deepEqual(saved.textbook, ["Книга 20", "Книга 10"]);
    assert.deepEqual(saved.content, { ...(before.profiles[1].content as object),
      "10": { theme: "Новая тема", lectures: 2 }, "11": { theme: "Legacy источника", control: 1 } });
    for (const field of ["place_more_text", "software", "additional_textbook", "content_more_text", "id", "public_id", "id_rpd_complect", "disciplins_name", "department", "place", "semester", "certification", "zet", "study_load", "control_load", "competencies", "assessment_tools_questions", "assessment_tools_template"])
      assert.deepEqual(saved[field], before.profiles[1][field], field);
    for (const field of fields) {
      assert.equal(saved.field_edits[field].userId, rop.id);
      assert.ok(Number.isFinite(Date.parse(saved.field_edits[field].at)));
    }
    assert.deepEqual(db.state.statuses, before.statuses);
    assert.deepEqual(db.state.assignments, before.assignments);
    assert.deepEqual(db.state.profiles[0], before.profiles[0]);
    // Повтор намеренно дописывает ещё раз; старый baseAt не допускает запись.
    const edit = saved.field_edits.goals.at;
    const repeated = await imports.copy(rop, 10, 20, { field: "goals", baseAt: edit, mode: "append" });
    assert.equal(repeated.value, "Цель 20<br/><br/>Цель 10<br/><br/>Цель 10");
    assert.equal(repeated.edit?.userId, rop.id);
    assert.notEqual(repeated.edit?.at, edit);
    for (const field of ["textbook", "content"] as const)
      await imports.copy(rop, 10, 20, { field, baseAt: saved.field_edits[field].at, mode: "append" });
    assert.deepEqual(db.state.profiles[1].textbook, ["Книга 20", "Книга 10", "Книга 10"]);
    assert.deepEqual(db.state.profiles[1].content, { ...(before.profiles[1].content as object),
      "10": { theme: "Новая тема", lectures: 2 }, "11": { theme: "Legacy источника", control: 1 },
      "12": { theme: "Новая тема", lectures: 2 }, "13": { theme: "Legacy источника", control: 1 } });
    const afterRepeat = structuredClone(db.state);
    await assert.rejects(imports.copy(rop, 10, 20, { field: "goals", baseAt: edit, mode: "append" }), { status: 409 });
    assert.deepEqual(db.state, afterRepeat);
  });
});

test("пустое содержание не стирает цель в append, replace и старый клиент копируют NULL и пустые значения", async (t) => {
  for (const mode of ["append", "replace", undefined] as const) await t.test(String(mode), async () => {
    for (const content of [null, {}, [], { __attestation__: { theme: "Чужой экзамен", control: 9 } }]) {
      const db = templateDatabase();
      db.state.profiles[0].content = content;
      db.state.profiles[0].goals = null;
      db.state.profiles[0].textbook = [];
      db.state.profiles[0].software = "";
      const previous = structuredClone(db.state.profiles[1]);
      const result = await new TemplateImport(db.db).copy(rop, 10, 20, { mode });
      for (const field of ["content", "goals", "textbook", "software"] as const)
        assert.deepEqual(result.targetTemplate[field], mode === "append" ? previous[field] : db.state.profiles[0][field]);
    }
  });
});

test("явный неверный mode, включая null, отклоняется во всех областях до записи", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  const baseline = (await imports.sources(rop, undefined, 2)).targetRevision;
  const before = structuredClone(db.state);
  for (const mode of [null, "", "merge", false, 0, [], {}]) {
    await assert.rejects(imports.copy(rop, 10, 20, { field: "goals", baseAt: null, mode }), { status: 422 });
    await assert.rejects(imports.copy(rop, 10, 20, { mode }), { status: 422 });
    await assert.rejects(imports.complect(rop, 1, 2, baseline, undefined, mode), { status: 422 });
  }
  assert.deepEqual(db.state, before);
});

test("append заполняет пустую цель, исключает аттестацию источника и сохраняет legacy-массив при пустом источнике", async () => {
  const db = templateDatabase();
  db.state.profiles[0].content = { legacy: { theme: "Тема источника" }, __attestation__: { theme: "Чужой экзамен", control: 9 } };
  db.state.profiles[1].content = null;
  db.state.profiles[1].goals = " \n ";
  db.state.profiles[1].textbook = null;
  const imports = new TemplateImport(db.db);
  const result = await imports.copy(rop, 10, 20, { mode: "append" });
  assert.equal(result.targetTemplate.goals, "Цель 10");
  assert.deepEqual(result.targetTemplate.textbook, ["Книга 10"]);
  assert.deepEqual(result.targetTemplate.content, { "1": { theme: "Тема источника" } });
  for (const content of [{}, { __attestation__: { theme: "Чужой экзамен", control: 9 } }]) {
    const previous = [{ theme: "Старая тема массива" }];
    db.state.profiles[0].content = content;
    db.state.profiles[1].content = previous;
    const applied = await imports.copy(rop, 10, 20, { mode: "append" });
    assert.deepEqual(applied.targetTemplate.content, previous);
  }
  db.state.profiles[0].content = [{ theme: "Новая тема массива" }];
  db.state.profiles[1].content = [{ theme: "Старая тема массива" }];
  assert.deepEqual((await imports.copy(rop, 10, 20, { mode: "append" })).targetTemplate.content,
    [{ theme: "Старая тема массива" }, { theme: "Новая тема массива" }]);
});

test("Word после переиспользования merge сохраняет экранирование, строки и целевую аттестацию", async () => {
  const db = templateDatabase();
  const imports = new TemplateImport(db.db);
  const sentinel = (db.state.profiles[1].content as Record<string, unknown>).__attestation__;
  const row = { theme: "Тема <Word>", total: 2, lectures: 2, seminars: 0, contact: 2, independent_work: 0, control: null };
  const baseline = (await imports.wordSnapshot(teacher, 20)).targetRevision;
  const replaced = await imports.wordApply(teacher, 20, { expectedRevision: baseline, mode: "replace", selectedFields: ["goals", "content"],
    values: { goals: "Цель <Word>", content: { "9": row } } });
  assert.deepEqual(replaced.targetTemplate.content, { "1": { ...row, theme: "Тема &lt;Word&gt;" }, __attestation__: sentinel });
  const appended = await imports.wordApply(teacher, 20, { expectedRevision: replaced.targetRevision, mode: "append", selectedFields: ["goals", "content"],
    values: { goals: "Цель <Word>", content: { "9": row } } });
  assert.equal(appended.targetTemplate.goals, "Цель &lt;Word&gt;<br/><br/>Цель &lt;Word&gt;");
  assert.deepEqual(appended.targetTemplate.content, { "1": { ...row, theme: "Тема &lt;Word&gt;" },
    "2": { ...row, theme: "Тема &lt;Word&gt;" }, __attestation__: sentinel });
});
