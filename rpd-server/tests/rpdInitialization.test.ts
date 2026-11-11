import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import axios from "axios";
import type { Request, Response } from "express";
import { pool } from "../config/db.ts";
import { exchange1C } from "../app/modules/1cExchange.ts";
import { applySync } from "../app/modules/complectSync.ts";
import TemplateWorkflow from "../app/services/TemplateWorkflow.ts";
import { USER_ROLES } from "../app/models/constants.ts";
import RpdComplectsController from "../app/controllers/rpdComplectsController.ts";

const actor = { id: 7, role: USER_ROLES.ROP, userName: "rop" };
const apiData = { faculty: "Факультет", year: 2026, educationForm: "Очная", educationLevel: "Бакалавриат", profile: "Профиль", direction: "09.03.01" };
const raw = { discipline: "Программирование", division: "Кафедра ВМ", semester: 1, record_type: "1.О", teachers: ["Иванов И.И."], study_load: { "Лекции": 36 }, control_load: {} };
const incoming = { discipline: "Программирование", department: "Кафедра ВМ", semester: 1, record_type: "1.О", place: "Обязательная часть", teachers: ["Иванов И.И."], zet: 1, study_load: [{ name: "Лекции", id: 36 }], control_load: {} };
type Row = Record<string, unknown>;
type State = { complects: Row[]; owners: Row[]; exchange: Row[]; profiles: Row[]; statuses: Row[]; participants: Row[]; changes: Row[] };

// Только адаптер внешней БД: реальные загрузчик, sync и workflow выполняются целиком.
// Этот double не доказывает SQL, ограничения и конкурентные блокировки PostgreSQL.
function database(t: TestContext, currentActor = actor) {
  let state: State = { complects: [], owners: [], exchange: [], profiles: [], statuses: [], participants: [], changes: [] };
  let transaction: State | undefined;
  let failStatus = false;
  let active = true;
  let currentRole = currentActor.role;
  let rawRows: unknown[] = [raw];
  const tables: Record<string, keyof State> = { rpd_complects: "complects", user_complect: "owners", rpd_1c_exchange: "exchange", rpd_profile_templates: "profiles", template_status: "statuses", teacher_templates: "participants", template_field_changes: "changes" };
  async function query(sql: string, values: unknown[] = [], connected = false): Promise<{ rows: Row[] }> {
    const text = sql.replace(/\s+/g, " ").trim();
    const from = /^SELECT\b.*?\bFROM (\w+)/.exec(text)?.[1];
    if (text === "BEGIN") { transaction = structuredClone(state); return { rows: [] }; }
    if (text === "COMMIT") { state = transaction!; transaction = undefined; return { rows: [] }; }
    if (text === "ROLLBACK") { transaction = undefined; return { rows: [] }; }
    const db = connected && transaction ? transaction : state;
    if (text.includes("AS owner")) return { rows: [{ exists: db.complects.some((row) => row.id === values[0]), owner: db.owners.some((row) => row.complect_id === values[0] && row.user_id === values[1]), active }] };
    if (from === "users") return { rows: [{ id: currentActor.id, role: currentRole, is_active: active, fullname: { surname: "Руководитель" } }] };
    if (text.startsWith("INSERT INTO complect_sync_log")) return { rows: [{ id: 30 }] };
    const insert = /^INSERT INTO (\w+)\s*\(([^)]+)\) VALUES\s*\(([^)]+)\)/.exec(text);
    if (insert && tables[insert[1]]) {
      if (insert[1] === "template_status" && failStatus) { failStatus = false; throw new Error("status write failed"); }
      const records = db[tables[insert[1]]];
      const fields = insert[2].split(",").map((field) => field.trim());
      const tokens = insert[3].split(",").map((token) => token.trim());
      const row: Row = { id: records.length + 1 };
      fields.forEach((field, i) => {
        const token = tokens[i];
        const parameter = /^\$(\d+)/.exec(token);
        row[field] = parameter ? values[Number(parameter[1]) - 1] : token === "NULL" ? null : token.replace(/^'|'$/g, "");
        if (token.includes("::jsonb") || ["study_load", "control_load"].includes(field) && typeof row[field] === "string") row[field] = JSON.parse(String(row[field]));
      });
      let existing: Row | undefined;
      if (insert[1] === "rpd_complects") existing = records.find((item) => fields.every((field) => String(item[field]) === String(row[field])));
      if (insert[1] === "rpd_1c_exchange") existing = records.find((item) => item.id_rpd_complect === row.id_rpd_complect && item.discipline === row.discipline && (item.semester ?? -1) === (row.semester ?? -1) && (item.record_type ?? "") === (row.record_type ?? ""));
      if (insert[1] === "template_status") existing = records.find((item) => row.id_1c_template != null && item.id_1c_template === row.id_1c_template || row.id_profile_template != null && item.id_profile_template === row.id_profile_template);
      if (existing) {
        if (text.includes("DO NOTHING")) return { rows: [] };
        for (const assignment of text.matchAll(/(\w+) = EXCLUDED\.(\w+)/g)) existing[assignment[1]] = row[assignment[2]];
        if (text.includes("removed_at = NULL")) existing.removed_at = null;
        return { rows: [existing] };
      }
      records.push(row);
      return { rows: [row] };
    }
    if (text.startsWith("UPDATE template_status")) {
      const row = db.statuses.find((item) => item.id === values[2]);
      if (row) { row.id_profile_template = values[0]; row.current_status = "created"; row.history = [...row.history as Row[] ?? [], ...JSON.parse(String(values[1]))]; }
      return { rows: [] };
    }
    if (text.startsWith("UPDATE rpd_complects")) return { rows: [] };
    if (from === "rpd_complects") return { rows: db.complects.filter((row) => values.length === 6
      ? [row.faculty, row.year, row.education_form, row.education_level, row.profile, row.direction].every((value, i) => String(value) === String(values[i]))
      : String(row.id) === String(values[0]) || row.uuid === values[0]) };
    if (from === "user_complect") return { rows: db.owners.filter((row) => row.complect_id === values[0]) };
    if (from === "rpd_1c_exchange") {
      if (text.includes("LEFT JOIN template_status")) return { rows: db.exchange.filter((row) => row.id_rpd_complect === values[0]).map((row) => ({ ...row, id_profile_template: db.statuses.find((status) => status.id_1c_template === row.id)?.id_profile_template ?? null })) };
      if (text.includes("discipline = $2")) return { rows: db.exchange.filter((row) => row.id_rpd_complect === values[0] && row.discipline === values[1] && (row.semester ?? -1) === (values[2] ?? -1) && (row.record_type ?? "") === (values[3] ?? "")) };
      return { rows: db.exchange.filter((row) => row.id === values[0] && row.id_rpd_complect === values[1]) };
    }
    if (from === "template_status") return { rows: db.statuses.filter((row) => Array.isArray(values[0]) ? values[0].includes(row.id_profile_template) : row.id_1c_template === values[0]) };
    if (from === "teacher_templates") return { rows: db.participants.filter((row) => Array.isArray(values[0]) && values[0].includes(row.templateId)) };
    if (from === "rpd_profile_templates" && text.includes("JOIN users actor")) return { rows: db.profiles.filter((row) => Array.isArray(values[0]) && values[0].includes(row.id)) };
    if (from === "rpd_profile_templates") return { rows: db.profiles.filter((row) => row.id_rpd_complect === values[0] && String(row.disciplins_name).trim().toLowerCase() === String(values[1]).trim().toLowerCase() && row.semester === values[2] && !db.statuses.some((status) => status.id_profile_template === row.id && status.id_1c_template != null)) };
    throw new Error(`Не поддерживается тестовым адаптером: ${text}`);
  }
  const client = { query: (sql: string, values?: unknown[]) => query(sql, values, true), release: () => {} } as unknown as PoolClient;
  t.mock.method(pool, "query", (sql: string, values?: unknown[]) => query(sql, values));
  t.mock.method(pool, "connect", async () => client);
  t.mock.method(axios, "post", async () => {
    assert.equal(transaction, undefined, "HTTP-запрос должен завершиться до начала транзакции");
    return { data: rawRows };
  });
  return { get state() { return state; }, set rawRows(rows: unknown[]) { rawRows = rows; }, failStatus() { failStatus = true; }, deactivate() { active = false; }, demote() { currentRole = USER_ROLES.TEACHER; } };
}

function seed(db: ReturnType<typeof database>, removed = false) {
  db.state.complects.push({ id: 1, faculty: apiData.faculty, year: apiData.year, education_form: apiData.educationForm, education_level: apiData.educationLevel, profile: apiData.profile, direction: apiData.direction });
  db.state.owners.push({ user_id: actor.id, complect_id: 1 });
  db.state.exchange.push({ ...incoming, id: 1, id_rpd_complect: 1, removed_at: removed ? "2026-01-01" : null });
}

test("первичная загрузка сразу создаёт одну РПД на обменный ключ без назначения преподавателей", async (t) => {
  const db = database(t);
  db.rawRows = [raw, raw, { ...raw, discipline: "  " }, { ...raw, record_type: "1.В" }];
  assert.equal(await exchange1C(apiData, { actor }), 1);
  assert.equal(db.state.exchange.length, 2);
  assert.equal(db.state.profiles.length, 2);
  assert.deepEqual(db.state.statuses.map((row) => [row.id_1c_template, row.id_profile_template, row.current_status]), [[1, 1, "created"], [2, 2, "created"]]);
  assert.equal(db.state.profiles[0].disciplins_name, "Программирование");
  assert.equal(db.state.profiles[0].department, "Кафедра ВМ");
  assert.equal(db.state.profiles[0].semester, 1);
  assert.deepEqual(db.state.profiles[0].competencies, {});
  assert.deepEqual(db.state.profiles[0].study_load, { "Лекции": 36 });
  assert.deepEqual(db.state.participants, []);
});

for (const [name, role] of [["РОП", USER_ROLES.ROP], ["администратор", USER_ROLES.ADMIN]] as const) {
  test(`${name} создаёт комплект через controller и настоящий импорт; повтор сохраняет назначенных РОП`, async (t) => {
    const creator = { ...actor, role };
    const db = database(t, creator);
    const controller = new RpdComplectsController(pool);
    const request = { user: creator, body: { data: {
      faculty: apiData.faculty, year: String(apiData.year), formEducation: apiData.educationForm,
      levelEducation: apiData.educationLevel, profile: apiData.profile, directionOfStudy: apiData.direction,
    } } } as Request;
    let response: unknown;
    const res = { json: (value: unknown) => { response = value; } } as Response;
    await controller.createRpdComplect(request, res);
    assert.equal(response, 1);
    assert.equal(db.state.complects.length, 1);
    assert.equal(db.state.profiles.length, 1);
    assert.deepEqual(db.state.owners.map((row) => row.user_id), [creator.id]);
    db.state.owners.splice(0, db.state.owners.length, ...[creator.id, 20, 21].map((user_id) => ({ user_id, complect_id: 1 })));
    const before = structuredClone(db.state);
    await controller.createRpdComplect(request, res);
    assert.deepEqual(db.state, before);
  });
}

test("изменение активности или роли во время 1С откатывает создание до импорта", async (t) => {
  for (const change of ["deactivate", "demote"] as const) {
    await t.test(change, async (t) => {
      const db = database(t);
      t.mock.method(axios, "post", async () => { db[change](); return { data: [raw] }; });
      await assert.rejects(exchange1C(apiData, { actor }), { status: 403 });
      assert.deepEqual(db.state, { complects: [], owners: [], exchange: [], profiles: [], statuses: [], participants: [], changes: [] });
    });
  }
});

test("ошибка инициализации откатывает весь комплект вместе с владельцем и обменом", async (t) => {
  const db = database(t);
  db.failStatus();
  await assert.rejects(exchange1C(apiData, { actor }), /status write failed/);
  assert.deepEqual(db.state, { complects: [], owners: [], exchange: [], profiles: [], statuses: [], participants: [], changes: [] });
  assert.equal(await exchange1C(apiData, { actor }), 1);
  assert.equal(db.state.profiles.length, 1);
});

test("повтор загрузки и старый create сохраняют готовую РПД, историю и участников", async (t) => {
  const db = database(t);
  seed(db);
  db.state.profiles.push({ id: 50, id_rpd_complect: 1, disciplins_name: "Авторское название", goals: "Авторский текст", competencies: { ПК: [1] }, content: [{ theme: "Тема" }] });
  db.state.statuses.push({ id: 10, id_1c_template: 1, id_profile_template: 50, current_status: "ready", history: [{ date: "2026-01-01T00:00:00Z", status: "ready" }] });
  db.state.participants.push({ templateId: 50, userId: 9, state: "done", isActive: true, name: "teacher", fullname: { surname: "Иванов" }, updatedAt: "2026-01-01T00:00:00Z" });
  const before = structuredClone(db.state);
  await exchange1C(apiData, { actor });
  const result = await new TemplateWorkflow(pool).createFrom1c(1, 1, actor, [99]);
  assert.equal(result.templateId, 50);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.participants.map((part) => part.userId), [9]);
  assert.deepEqual(db.state, before);
});

test("sync.add создаёт связанную РПД внутри своей транзакции и допускает повтор", async (t) => {
  const db = database(t);
  db.state.complects.push({ id: 1 });
  db.state.owners.push({ user_id: actor.id, complect_id: 1 });
  const request = { complectId: 1, actor, selections: [{ action: "add", incoming }] };
  await applySync(request);
  const before = structuredClone({ profiles: db.state.profiles, statuses: db.state.statuses, participants: db.state.participants });
  assert.equal(db.state.profiles.length, 1);
  assert.deepEqual(db.state.statuses.map((row) => [row.id_1c_template, row.id_profile_template, row.current_status]), [[1, 1, "created"]]);
  assert.deepEqual(db.state.participants, []);
  await applySync(request);
  assert.equal(db.state.exchange.length, 1);
  assert.deepEqual({ profiles: db.state.profiles, statuses: db.state.statuses, participants: db.state.participants }, before);
});

test("ошибка sync.add не оставляет обменную строку без РПД", async (t) => {
  const db = database(t);
  db.state.complects.push({ id: 1 });
  db.state.owners.push({ user_id: actor.id, complect_id: 1 });
  const before = structuredClone(db.state);
  db.failStatus();
  await assert.rejects(applySync({ complectId: 1, actor, selections: [{ action: "add", incoming }] }), /status write failed/);
  assert.deepEqual(db.state, before);
});

test("sync.add восстанавливает удалённый обмен, сохраняя связанную готовую РПД", async (t) => {
  const db = database(t);
  seed(db, true);
  db.state.profiles.push({ id: 50, id_rpd_complect: 1, goals: "Авторский текст", zet: 5 });
  db.state.statuses.push({ id: 10, id_1c_template: 1, id_profile_template: 50, current_status: "ready", history: [{ status: "ready", date: "2026-01-01" }] });
  db.state.participants.push({ templateId: 50, userId: 9, state: "done" });
  const before = structuredClone({ profiles: db.state.profiles, statuses: db.state.statuses, participants: db.state.participants });
  await applySync({ complectId: 1, actor, selections: [{ action: "add", incoming: { ...incoming, zet: 2 } }] });
  assert.equal(db.state.exchange.length, 1);
  assert.equal(db.state.exchange[0].removed_at, null);
  assert.equal(db.state.exchange[0].zet, 2);
  assert.deepEqual({ profiles: db.state.profiles, statuses: db.state.statuses, participants: db.state.participants }, before);
});

test("повтор загрузки достраивает legacy unloaded, сохраняя прежнюю историю", async (t) => {
  const db = database(t);
  seed(db);
  const event = { status: "unloaded", date: "2026-01-01T00:00:00Z", user: "Система" };
  db.state.statuses.push({ id: 10, id_1c_template: 1, id_profile_template: null, current_status: "unloaded", history: [event] });
  await exchange1C(apiData, { actor });
  assert.equal(db.state.profiles.length, 1);
  assert.equal(db.state.statuses.length, 1);
  assert.equal(db.state.statuses[0].id, 10);
  assert.equal(db.state.statuses[0].current_status, "created");
  assert.deepEqual((db.state.statuses[0].history as Row[])[0], event);
  const before = structuredClone(db.state);
  await exchange1C(apiData, { actor });
  assert.deepEqual(db.state, before);
});

test("старый create создаёт РПД с метаданными обмена и игнорирует устаревшие teacherIds", async (t) => {
  const db = database(t);
  seed(db);
  const result = await new TemplateWorkflow(pool).createFrom1c(1, 1, actor, [9]);
  assert.equal(result.templateId, 1);
  assert.equal(result.status, "created");
  assert.deepEqual(result.participants, []);
  const profile = db.state.profiles[0];
  assert.equal(profile.id_rpd_complect, 1);
  assert.equal(profile.disciplins_name, "Программирование");
  assert.equal(profile.department, "Кафедра ВМ");
  assert.equal(profile.semester, 1);
  assert.equal(profile.place, "Обязательная часть");
  assert.equal(profile.zet, 1);
  assert.deepEqual(profile.competencies, {});
  assert.deepEqual(profile.study_load, [{ name: "Лекции", id: 36 }]);
  assert.deepEqual(profile.control_load, {});
  const before = structuredClone(db.state);
  await new TemplateWorkflow(pool).createFrom1c(1, 1, actor, [9]);
  assert.deepEqual(db.state, before);
});

test("несвязанная legacy-РПД останавливает создание дубликата", async (t) => {
  const db = database(t);
  seed(db);
  db.state.profiles.push({ id: 50, id_rpd_complect: 1, disciplins_name: " программирование ", semester: 1, goals: "Сохранить" });
  db.state.statuses.push({ id: 10, id_1c_template: null, id_profile_template: 50, current_status: "ready", history: [] });
  const before = structuredClone(db.state);
  await assert.rejects(new TemplateWorkflow(pool).createFrom1c(1, 1, actor, []), { status: 409, error: /Неоднозначная/ });
  assert.deepEqual(db.state, before);
});

test("пустая дисциплина не создаёт РПД ни через sync.add, ни через старый create", async (t) => {
  const db = database(t);
  seed(db);
  db.state.exchange[0].discipline = " \t\n ";
  await applySync({ complectId: 1, actor, selections: [{ action: "add", incoming: { ...incoming, discipline: " \t\n " } }] });
  await assert.rejects(new TemplateWorkflow(pool).createFrom1c(1, 1, actor, []), { status: 422 });
  assert.equal(db.state.profiles.length, 0);
  assert.equal(db.state.statuses.length, 0);
  assert.equal(db.state.changes.length, 0);
});

test("первичная повторная загрузка не восстанавливает удалённую строку и не создаёт для неё РПД", async (t) => {
  const db = database(t);
  seed(db, true);
  const before = structuredClone(db.state);
  await exchange1C(apiData, { actor });
  assert.deepEqual(db.state, before);
  await assert.rejects(new TemplateWorkflow(pool).createFrom1c(1, 1, actor, []), { status: 422, error: /удален/ });
  assert.deepEqual(db.state, before);
});

test("старый create сохраняет проверку прав даже при уже существующей РПД", async (t) => {
  const db = database(t);
  seed(db);
  db.state.profiles.push({ id: 50, id_rpd_complect: 1, disciplins_name: "Программирование" });
  db.state.statuses.push({ id: 10, id_1c_template: 1, id_profile_template: 50, current_status: "created", history: [] });
  db.deactivate();
  const before = structuredClone(db.state);
  await assert.rejects(new TemplateWorkflow(pool).createFrom1c(1, 1, actor, []), { status: 403 });
  assert.deepEqual(db.state, before);
});
