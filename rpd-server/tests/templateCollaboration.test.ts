import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";
import RpdProfileTemplatesController from "../app/controllers/rpdProfileTemplatesController.ts";
import TemplatePresence from "../app/services/TemplatePresence.ts";
import { fieldEditsSet, withEditorNames } from "../app/modules/fieldEdits.ts";

const at = "2026-09-27T19:51:30.123456Z";

test("SQL отметки использует время PostgreSQL и заданные номера параметров", () => {
  const sql = fieldEditsSet(5, 6);
  assert.match(sql, /unnest\(\$6::text\[\]\)/);
  assert.match(sql, /'userId', \$5::int/);
  assert.match(sql, /clock_timestamp\(\) AT TIME ZONE 'UTC'/);
  assert.match(sql, /HH24:MI:SS\.US/);
});

test("имена авторов загружаются одним запросом, 1С не ищется в users", async () => {
  const queries: Array<{ sql: string; values: unknown[] | undefined }> = [];
  const db = { query: async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values });
    return { rows: [{ id: 7, fullname: { surname: "Альфина", name: "Татьяна", patronymic: "Тимофеевна" } }] };
  } } as unknown as Pool;
  const edits = await withEditorNames(db, { goals: { userId: 7, at }, content: { userId: 7, at }, zet: { userId: null, at } });
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].values, [[7]]);
  assert.equal(edits.goals.fullname, "Альфина Т.Т.");
  assert.equal(edits.zet.fullname, "1С");
});

test("update-json-value требует baseAt и поле из whitelist", async () => {
  const controller = new RpdProfileTemplatesController({} as Pool);
  const request = (body: Record<string, unknown>) => ({ body, params: { id: "1" } }) as unknown as Request;
  await assert.rejects(controller.updateById(request({ fieldToUpdate: "goals", value: "Новая цель" }), {} as Response), { status: 422 });
  await assert.rejects(controller.updateById(request({ fieldToUpdate: "goals", value: "Новая цель", baseAt: 1 }), {} as Response), { status: 422 });
  await assert.rejects(controller.updateById(request({ fieldToUpdate: "field_edits", value: {}, baseAt: null }), {} as Response), { status: 422 });
});

test("условное обновление возвращает значение и автора", async () => {
  const calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  const db = { query: async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: 12 }] };
    if (sql.startsWith("UPDATE rpd_profile_templates")) return { rows: [{ value: "Цель", edit: { userId: 7, at } }] };
    if (sql.includes("FROM users")) return { rows: [{ id: 7, fullname: { surname: "Альфина", name: "Татьяна", patronymic: "Тимофеевна" } }] };
    throw new Error(`Неожиданный запрос: ${sql}`);
  } } as unknown as Pool;
  const result = await new RpdProfileTemplates(db).updateById(12, "goals", "Цель", null, 7);
  assert.deepEqual(result, { field: "goals", value: "Цель", edit: { userId: 7, fullname: "Альфина Т.Т.", at } });
  const update = calls.find((call) => call.sql.startsWith("UPDATE"));
  assert.match(update?.sql ?? "", /IS NOT DISTINCT FROM \$4/);
  assert.deepEqual(update?.values, ["Цель", 12, "goals", null, 7, ["goals"]]);
});

test("конфликт возвращает актуальное значение, автора и время", async () => {
  const db = { query: async (sql: string) => {
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: 12 }] };
    if (sql.startsWith("UPDATE rpd_profile_templates")) return { rows: [] };
    if (sql.startsWith("SELECT goals AS value")) return { rows: [{ value: "Чужая цель", edit: { userId: 7, at } }] };
    if (sql.includes("FROM users")) return { rows: [{ id: 7, fullname: { surname: "Альфина", name: "Татьяна", patronymic: "Тимофеевна" } }] };
    throw new Error(`Неожиданный запрос: ${sql}`);
  } } as unknown as Pool;
  await assert.rejects(new RpdProfileTemplates(db).updateById(12, "goals", "Моя цель", null, 8), (error: unknown) => {
    assert.equal((error as { status: number }).status, 409);
    assert.deepEqual((error as { error: unknown }).error, { message: "Поле уже изменено", field: "goals", value: "Чужая цель", edit: { userId: 7, fullname: "Альфина Т.Т.", at } });
    return true;
  });
});

test("присутствие исключает себя, разделяет шаблоны и истекает через 45 секунд", async () => {
  let now = 0;
  let userQueries = 0;
  const db = { query: async (sql: string) => {
    if (sql.includes("SELECT field_edits")) return { rows: [{ field_edits: { goals: { userId: 1, at } } }] };
    if (sql.includes("FROM users")) {
      userQueries += 1;
      return { rows: [
        { id: 1, fullname: { surname: "Альфина", name: "Татьяна", patronymic: "Тимофеевна" } },
        { id: 2, fullname: { surname: "Яковлева", name: "Татьяна", patronymic: "Тимофеевна" } },
      ] };
    }
    throw new Error(`Неожиданный запрос: ${sql}`);
  } } as unknown as Pool;
  const presence = new TemplatePresence(db, () => now);
  assert.deepEqual((await presence.touch(10, 1)).editors, []);
  assert.deepEqual((await presence.touch(20, 2)).editors, []);
  assert.deepEqual((await presence.touch(10, 2)).editors, [{ userId: 1, fullname: "Альфина Т.Т." }]);
  assert.equal(userQueries, 3);
  now = 45_000;
  assert.deepEqual((await presence.touch(10, 2)).editors, []);
  assert.equal((await presence.touch(20, 1)).editors.length, 0);
});
