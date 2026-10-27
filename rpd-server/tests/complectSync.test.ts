import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import axios from "axios";
import { pool } from "../config/db.ts";
import * as sync from "../app/modules/complectSync.ts";
import { USER_ROLES } from "../app/models/constants.ts";
import type { Rpd1cExchangeRow, RpdProfileTemplateRow } from "../app/types/db.ts";
import { normalizeDisciplineFrom1c } from "../app/modules/normalizeDisciplineFrom1c.ts";

const actor = { id: 7, role: USER_ROLES.ROP, userName: "rop" };

const rawDiscipline = {
  discipline: "Программирование", semester: 1, record_type: "1.О", division: "Кафедра ВМ",
  teachers: ["Иванов И.И."], zets: 36,
  study_load: { "СРС": 40, "Лекции": 34, "Практические": 34 }, control_load: { "Экзамен": 36 },
};
const incoming = normalizeDisciplineFrom1c(rawDiscipline);
const exchange: Rpd1cExchangeRow = { ...incoming, zet: 4, id: 11, id_rpd_complect: 2, removed_at: null };
type Profile = Pick<RpdProfileTemplateRow, "id" | "disciplins_name" | "department" | "semester" | "zet" | "place" | "study_load" | "control_load" | "certification">;
const profile: Profile = {
  id: 50, disciplins_name: exchange.discipline, department: exchange.department, semester: exchange.semester,
  zet: 4, place: exchange.place, study_load: exchange.study_load, control_load: exchange.control_load, certification: "Экзамен",
};
type Fixture = { exchange: Rpd1cExchangeRow; profile: Profile | null };
type QueryCall = { sql: string; values?: unknown[] };

function mockSync(t: TestContext, fixtures: Fixture[], rawIncoming: unknown[] = [rawDiscipline]) {
  const calls: QueryCall[] = [];
  t.mock.method(axios, "post", async (url: string) => {
    assert.match(url, /\/GetDisciplinesByPlan$/);
    return { data: rawIncoming };
  });
  t.mock.method(pool, "query", async (sql: string, values?: unknown[]) => {
    if (sql.includes("FROM rpd_complects")) return { rows: [{
      id: 2, uuid: "complect-2", faculty: "Факультет", year: 2026,
      education_form: "Очная", education_level: "Бакалавриат", profile: "Профиль", direction: "09.03.01",
      last_synced_at: null, has_pending_changes: false,
    }] };
    if (sql.includes("FROM rpd_1c_exchange")) {
      assert.deepEqual(values, [2]);
      return { rows: fixtures.map(({ exchange: row, profile: linked }) => ({
        ...row, id_profile_template: linked?.id ?? null,
        profile_discipline: linked?.disciplins_name ?? null, profile_department: linked?.department ?? null,
        profile_semester: linked?.semester ?? null, profile_zet: linked?.zet ?? null, profile_place: linked?.place ?? null,
        profile_study_load: linked?.study_load ?? null, profile_control_load: linked?.control_load ?? null,
        profile_certification: linked?.certification ?? null,
      })) };
    }
    throw new Error(`Неожиданный запрос к пулу: ${sql}`);
  });
  const client = {
    query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO complect_sync_log")) return { rows: [{ id: 30 }] };
      if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)
        || sql.includes("SELECT id FROM rpd_complects") || sql.includes("UPDATE rpd_complects")
        || sql.includes("UPDATE rpd_1c_exchange") || sql.includes("UPDATE rpd_profile_templates")
        || sql.includes("INSERT INTO template_field_changes")) return { rows: [] };
      throw new Error(`Неожиданный запрос транзакции: ${sql}`);
    },
    release: () => {},
  } as unknown as PoolClient;
  t.mock.method(pool, "connect", async () => client);
  return calls;
}

test("preview читает связанную РПД, обнаруживает только дрейф нагрузки и сохраняет обменный ключ", async (t) => {
  const priorStudyLoad = [{ name: "Всего", id: 144 }];
  const priorControlLoad = { "Зачет": "да" };
  mockSync(t, [{ exchange, profile: {
    ...profile, disciplins_name: "Название в редакторе", semester: 8, department: "Авторская кафедра", place: "Авторское место",
    study_load: JSON.stringify(priorStudyLoad), control_load: JSON.stringify(priorControlLoad), zet: 3,
  } }]);
  const { diff } = await sync.preview1cSync("complect-2");
  assert.equal(diff.new.length, 0);
  assert.equal(diff.removed.length, 0);
  assert.equal(diff.unchanged.length, 0);
  assert.equal(diff.updated.length, 1);
  const update = diff.updated[0];
  assert.equal(update.key, "Программирование|1|1.О");
  assert.equal(update.local.discipline, exchange.discipline);
  assert.equal(update.local.semester, exchange.semester);
  assert.equal(update.hasProfileTemplate, true);
  assert.deepEqual(update.fields, [
    { field: "zet", old: 3, new: 4 },
    { field: "study_load", old: priorStudyLoad, new: incoming.study_load },
    { field: "control_load", old: priorControlLoad, new: incoming.control_load },
  ]);
});

test("выбор полей preview исправляет только выбранную нагрузку и пишет прежнее значение РПД", async (t) => {
  const priorStudyLoad = [{ name: "Всего", id: 144 }];
  const calls = mockSync(t, [{ exchange, profile: { ...profile, study_load: priorStudyLoad, control_load: {}, zet: 3 } }]);
  const { diff } = await sync.preview1cSync(2);
  assert.equal(diff.updated.length, 1);
  const update = diff.updated[0];
  await sync.applySync({ complectId: 2, actor, selections: [{ action: "update", id_1c: update.id_1c, incoming: update.incoming, fields: ["study_load"] }] });
  const writes = calls.filter(({ sql }) => sql.includes("UPDATE rpd_profile_templates"));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].values, [JSON.stringify(incoming.study_load), null, ["study_load"], 50]);
  const exchangeWrite = calls.find(({ sql }) => sql.includes("UPDATE rpd_1c_exchange"));
  assert.ok(exchangeWrite);
  const history = calls.filter(({ sql }) => sql.includes("INSERT INTO template_field_changes"));
  assert.deepEqual(history.map(({ values }) => values), [[30, 11, 50, "study_load", JSON.stringify(priorStudyLoad), JSON.stringify(incoming.study_load)]]);
  for (const { sql } of calls) assert.doesNotMatch(sql, /\b(content|current_status|teacher_templates|template_status)\b/);
});

test("применение ЗЕТ и контроля сохраняет достоверную историю и форму аттестации", async (t) => {
  const calls = mockSync(t, [{ exchange, profile: { ...profile, control_load: { "Зачет": "да" }, zet: 3, certification: "Зачет" } }]);
  await sync.applySync({ complectId: 2, actor, selections: [{ action: "update", id_1c: 11, incoming, fields: ["zet", "control_load"] }] });
  const write = calls.find(({ sql }) => sql.includes("UPDATE rpd_profile_templates"));
  assert.ok(write);
  assert.deepEqual(write.values, [4, JSON.stringify(incoming.control_load), "Экзамен", null, ["zet", "control_load", "certification"], 50]);
  assert.deepEqual(calls.filter(({ sql }) => sql.includes("INSERT INTO template_field_changes")).map(({ values }) => values), [
    [30, 11, 50, "zet", "3", "4"],
    [30, 11, 50, "control_load", JSON.stringify({ "Зачет": "да" }), JSON.stringify(incoming.control_load)],
    [30, 11, 50, "certification", JSON.stringify("Зачет"), JSON.stringify("Экзамен")],
  ]);
});

for (const linked of [profile, null]) {
  test(`совпадающая нагрузка не создаёт изменений; связанный профиль: ${Boolean(linked)}`, async (t) => {
    mockSync(t, [{ exchange, profile: linked }]);
    const { diff } = await sync.preview1cSync(2);
    assert.equal(diff.updated.length, 0);
    assert.equal(diff.unchanged.length, 1);
    assert.equal(diff.unchanged[0].hasProfileTemplate, Boolean(linked));
  });
}

test("отменённый выбор не меняет РПД и не пишет историю ремонта", async (t) => {
  const calls = mockSync(t, [{ exchange, profile: { ...profile, study_load: [{ name: "Всего", id: 144 }] } }]);
  const { diff } = await sync.preview1cSync(2);
  assert.equal(diff.updated.length, 1);
  await sync.applySync({ complectId: 2, actor, selections: [] });
  assert.equal(calls.some(({ sql }) => sql.includes("UPDATE rpd_profile_templates") || sql.includes("UPDATE rpd_1c_exchange") || sql.includes("INSERT INTO template_field_changes")), false);
});

for (const { field, old } of [
  { field: "zet", old: 3 },
  { field: "study_load", old: [{ name: "Всего", id: 144 }] },
  { field: "control_load", old: { "Экзамен": "да" } },
] as const) {
  test(`отличие ${field} только в обмене обновляется без равнозначного уведомления РПД`, async (t) => {
    const calls = mockSync(t, [{ exchange: { ...exchange, [field]: old }, profile }]);
    const { diff } = await sync.preview1cSync(2);
    assert.equal(diff.updated.length, 1);
    assert.deepEqual(diff.updated[0].fields, [{ field, old, new: incoming[field] }]);
    await sync.applySync({ complectId: 2, actor, selections: [{ action: "update", id_1c: 11, incoming: diff.updated[0].incoming, fields: [field] }] });
    assert.equal(calls.some(({ sql }) => sql.includes("UPDATE rpd_profile_templates")), false);
    assert.ok(calls.some(({ sql }) => sql.includes("UPDATE rpd_1c_exchange")));
    assert.deepEqual(calls.filter(({ sql }) => sql.includes("INSERT INTO template_field_changes")).map(({ values }) => values), [[30, 11, null, field, JSON.stringify(old), JSON.stringify(incoming[field])]]);
  });
}

for (const linked of [profile, null]) {
  test(`обновление обмена и преподавателей сохраняет участников; связанный профиль: ${Boolean(linked)}`, async (t) => {
    const calls = mockSync(t, [{ exchange: { ...exchange, zet: 3, teachers: ["Прежний преподаватель"] }, profile: linked }]);
    const { diff } = await sync.preview1cSync(2);
    assert.deepEqual(diff.updated[0].fields.map(({ field }) => field), ["zet", "teachers"]);
    assert.equal(diff.updated[0].hasProfileTemplate, Boolean(linked));
    await sync.applySync({ complectId: 2, actor, selections: [{ action: "update", id_1c: 11, incoming: diff.updated[0].incoming, fields: ["zet", "teachers"] }] });
    assert.equal(calls.some(({ sql }) => sql.includes("UPDATE rpd_profile_templates")), false);
    for (const { sql } of calls) assert.doesNotMatch(sql, /\b(teacher_templates|template_status)\b/);
    assert.deepEqual(calls.filter(({ sql }) => sql.includes("INSERT INTO template_field_changes")).map(({ values }) => values), [
      [30, 11, null, "zet", "3", "4"],
      [30, 11, null, "teachers", JSON.stringify(["Прежний преподаватель"]), JSON.stringify(incoming.teachers)],
    ]);
  });
}

test("уведомления редактора выбирают последнее изменение каждого поля независимо от подтверждения", async (t) => {
  let query = "";
  let values: unknown[] | undefined;
  t.mock.method(pool, "query", async (sql: string, params?: unknown[]) => {
    query = sql;
    values = params;
    return { rows: [{ id: 2, field_key: "zet", old_value: 3, new_value: 4 }] };
  });
  assert.equal(typeof sync.getLatestFieldChanges, "function");
  const rows = await sync.getLatestFieldChanges(10);
  assert.deepEqual(rows, [{ id: 2, field_key: "zet", old_value: 3, new_value: 4 }]);
  assert.match(query, /DISTINCT ON \(field_key\)/);
  assert.match(query, /ORDER BY field_key, applied_at DESC, id DESC/);
  assert.doesNotMatch(query, /acknowledged_at/);
  assert.deepEqual(values, [10, "__new__"]);
});

for (const selections of [[], [{ action: "update", id_1c: 404 }], [{ action: "update", id_1c: 11, fields: ["teachers"], incoming: { teachers: ["Новый преподаватель"] } }], [{ action: "update", id_1c: 11, fields: ["zet"], incoming: { zet: 4 } }]]) {
  test(`синхронизация обновляет дату и общий флаг только по своему журналу: ${JSON.stringify(selections)}`, async (t) => {
    const calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
    const local = { id: 11, id_rpd_complect: 2, discipline: "Тест", teachers: [], zet: 3, id_profile_template: null };
    t.mock.method(pool, "query", async (sql: string) => {
      if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
      if (sql.includes("FROM rpd_complects")) return { rows: [{ id: 2 }] };
      if (sql.includes("FROM rpd_1c_exchange")) return { rows: [local] };
      throw new Error(`Неожиданный запрос: ${sql}`);
    });
    const client = { query: async (sql: string, values?: unknown[]) => {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO complect_sync_log")) return { rows: [{ id: 30 }] };
      if (sql.includes("AS owner")) return { rows: [{ exists: true, owner: true, active: true }] };
      return { rows: [] };
    }, release: () => { calls.push({ sql: "RELEASE", values: undefined }); } } as unknown as PoolClient;
    t.mock.method(pool, "connect", async () => client);
    assert.deepEqual(await sync.applySync({ complectId: 2, selections, actor }), { complectId: 2, syncLogId: 30 });
    const update = calls.find(({ sql }) => sql.includes("UPDATE rpd_complects"));
    assert.ok(update);
    assert.match(update.sql, /last_synced_at = NOW\(\)/);
    assert.match(update.sql, /has_pending_changes = EXISTS\s*\(\s*SELECT 1 FROM template_field_changes WHERE sync_log_id = \$2\s*\)/);
    assert.deepEqual(update.values, [2, 30]);
    assert.equal(calls[0].sql, "BEGIN");
    assert.equal(calls.at(-2)?.sql, "COMMIT");
    assert.equal(calls.at(-1)?.sql, "RELEASE");
    const changes = calls.filter(({ sql }) => sql.includes("INSERT INTO template_field_changes"));
    if (selections[0]?.id_1c === 11) {
      assert.equal(changes.length, 1);
      const selection = selections[0];
      assert.deepEqual(changes[0].values?.slice(0, 4), [30, 11, null, "fields" in selection ? selection.fields[0] : undefined]);
    } else {
      assert.equal(changes.length, 0);
    }
  });
}
