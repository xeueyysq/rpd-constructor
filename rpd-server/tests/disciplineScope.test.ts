import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { getStudyPlanHours, patchStudyLoad, getContentRowHours, sumContentHours, parseHours } from "../app/modules/disciplineScope.ts";
import { isEditableTemplateField, studyLoadSchema } from "../app/validators/RpdProfileTemplates.ts";
import requireRole from "../app/middleware/requireRole.ts";
import { USER_ROLES } from "../app/models/constants.ts";

describe("Часы учебного плана", () => {
  test("разбирает варианты практики и десятичную запятую", () => {
    const rows = ["Практика", "Практические", "Семинар", "Лабораторные"].map((name) => ({ name, id: "17,5" }));
    assert.equal(getStudyPlanHours(rows, null).seminars, 70);
    assert.equal(getStudyPlanHours(Object.fromEntries(rows.map(({ name, id }) => [name, id])), null).seminars, 70);
    assert.equal(parseHours(" 1 234,5 "), 1234.5);
  });
  test("не удваивает контроль и не вычисляет его остатком", () => {
    assert.equal(getStudyPlanHours({ "Контроль": 27 }, { "Экзамен": 10 }).control, 27);
    assert.equal(getStudyPlanHours({ "Контроль": 27 }, { "Экзамен": "да" }).control, 27);
    assert.equal(getStudyPlanHours({ "Лекции": 34 }, { "Экзамен": "17,5" }).control, 17.5);
    const hours = getStudyPlanHours({ "Всего": 144, "Лекции": 34, "Практические": 34, "КРП": 1, "СРС": 39 }, null);
    assert.equal(hours.control, 0);
    assert.equal(hours.all, 144);
  });
  test("совпадает с вектором учебного плана", () => {
    assert.deepEqual(getStudyPlanHours([
      { name: "Всего", id: 144 }, { name: "Лекции", id: 34 },
      { name: "Практические", id: 34 }, { name: "Контроль", id: 27 }, { name: "СРС", id: 49 },
    ], null), { all: 144, lectures: 34, seminars: 34, control: 27,
      independent_work: 49, contact: 68, has_total: true, has_breakdown: true });
  });
  test("сохраняет форму и неизвестные записи при исправлении", () => {
    assert.deepEqual(patchStudyLoad([
      { name: "Практические", id: "10", extra: true }, { name: "Лабораторные", id: 5 },
      { name: "КРП", id: 1 },
    ], { seminars: 20, control: 7 }), [
      { name: "Практические", id: "20", extra: true }, { name: "КРП", id: 1 },
      { name: "Контроль", id: 7 },
    ]);
    assert.deepEqual(patchStudyLoad({ "Практика": "10", "Лабораторные": 5, "КРП": { id: 1 } }, { seminars: 20, all: 40 }),
      { "Практика": "20", "КРП": { id: 1 }, "Всего": 40 });
    assert.deepEqual(patchStudyLoad(null, { lectures: 5 }), [{ name: "Лекции", id: 5 }]);
  });
});

describe("Часы содержания", () => {
  test("складывает лекции и практику в контакт, контроль — во всего", () => {
    assert.deepEqual(getContentRowHours({ lectures: "17,5", seminars: 10, control: 5, independent_work: null }),
      { lectures: 17.5, seminars: 10, contact: 27.5, control: 5, independent_work: 0, total: 32.5 });
    assert.deepEqual(sumContentHours({ first: { lectures: "17,5", seminars: 10, control: 5 }, second: { lectures: 2, independent_work: "3,5" } }),
      { lectures: 19.5, seminars: 10, contact: 29.5, control: 5, independent_work: 3.5, total: 38 });
  });
});

describe("Доступ к часам шаблона", () => {
  test("валидатор отклоняет пустые, отрицательные и нечисловые значения", async () => {
    for (const body of [{}, { hours: {} }, { hours: { all: -1 } }, { hours: { all: "12" } }, { zet: Infinity }]) {
      await assert.rejects(studyLoadSchema.validate({ params: { id: "1" }, body }));
    }
    await studyLoadSchema.validate({ params: { id: "1" }, body: { hours: { all: 0 }, zet: 4 } });
  });
  test("whitelist разрешает редакционные поля", () => {
    assert.equal(isEditableTemplateField("content"), true);
    for (const field of ["study_load", "control_load", "zet", "arbitrary", "content; DROP TABLE x"]) {
      assert.equal(isEditableTemplateField(field), false);
    }
  });
  test("роль РОП и админа проходит, преподаватель отклоняется", () => {
    const middleware = requireRole(USER_ROLES.ROP, USER_ROLES.ADMIN);
    for (const role of [USER_ROLES.ROP, USER_ROLES.ADMIN, USER_ROLES.TEACHER]) {
      let error: unknown;
      middleware({ user: { role } } as Request, {} as Response, ((nextError?: unknown) => { error = nextError; }) as NextFunction);
      assert.equal(error === undefined, role !== USER_ROLES.TEACHER);
    }
  });
});
