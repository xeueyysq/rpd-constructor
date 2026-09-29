import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import { fundsCompetences, selectedFundsQuestions } from "../app/modules/assessmentFunds.ts";
import { buildFosWorkbook, fosRows, type FosTemplate } from "../app/services/documents/fosWorkbook.ts";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";
import RpdProfileTemplatesController from "../app/controllers/rpdProfileTemplatesController.ts";
import TemplateWorkflow from "../app/services/TemplateWorkflow.ts";
import { USER_ROLES } from "../app/models/constants.ts";

const funds = (competencies: Record<string, unknown>) => ({ competencies });
const template = (name: string, semester: number, competencies: Record<string, unknown>): FosTemplate => ({ disciplins_name: name, semester, assessment_tools_questions: funds(competencies) });

test("разбор ФОС выбирает вопросы по ID, сохраняет порядок пула и пропускает мусор", () => {
  const value = funds({ "ОПК-1": {
    openPool: [{ id: "a", text: "Первый", correctAnswer: "Ответ" }, { id: "b", text: "Второй" }, { id: "bad", text: 12 }, null],
    closedPool: [{ id: "c", text: "Закрытый\nА) да" }],
    selectedOpenIds: ["b", "a", "bad"], selectedClosedIds: [],
  } });
  assert.deepEqual(fundsCompetences(value), ["ОПК-1"]);
  assert.deepEqual(selectedFundsQuestions(value, "ОПК-1"), { open: [{ text: "Первый", answer: "Ответ" }, { text: "Второй", answer: "" }], closed: [] });
  assert.deepEqual(selectedFundsQuestions(value, "УК-1"), { open: [], closed: [] });
  assert.deepEqual(fundsCompetences({ competencies: { bad: null, wrong: [] } }), []);
});

test("без списков выбора выгружаются все вопросы, старые строки разбиваются по строкам", () => {
  assert.deepEqual(selectedFundsQuestions(funds({ "ПК 2": {
    openPool: [{ id: "one", text: "Вопрос" }], closedPool: [{ id: "two", text: "Тест", correctAnswer: "Б" }],
  } }), "ПК 2"), { open: [{ text: "Вопрос", answer: "" }], closed: [{ text: "Тест", answer: "Б" }] });
  assert.deepEqual(selectedFundsQuestions(funds({ "ПК 2": { openQuestions: " Один \n\nДва\r\n", closedQuestions: "Три" } }), "ПК 2"), {
    open: [{ text: "Один", answer: "" }, { text: "Два", answer: "" }], closed: [{ text: "Три", answer: "" }],
  });
  assert.deepEqual(selectedFundsQuestions(funds({ "ПК 2": { openQuestions: "Один\nДва", selectedOpenIds: ["legacy_1"] } }), "ПК 2").open, [{ text: "Два", answer: "" }]);
  assert.deepEqual(selectedFundsQuestions({ competencies: { "ПК 2": { openPool: [false, { id: 1, text: "Нет" }, { id: "x", text: "" }] } } }, "ПК 2"), { open: [], closed: [] });
  assert.deepEqual(selectedFundsQuestions("битый JSON", "ПК 2"), { open: [], closed: [] });
});

test("DOCX использует общий разбор и по-прежнему возвращает выбранные вопросы", async () => {
  const db = { query: async (sql: string) => {
    if (sql.includes("FROM rpd_complects")) return { rows: [{ id: 7 }] };
    if (sql.includes("FROM planned_results_sets")) return { rows: [] };
    return { rows: [{ disciplins_name: "Алгоритмы", assessment_tools_questions: funds({ "ОПК-1": { openPool: [{ id: "a", text: "А" }, { id: "b", text: "Б" }], selectedOpenIds: ["b"] } }) }] };
  } } as unknown as Pool;
  const result = await new RpdProfileTemplates(db).getAssessmentFundsDocumentData(7, "ОПК-1");
  assert.deepEqual(result?.openQuestions, [{ text: "Б", answer: "", discipline: "Алгоритмы" }]);
  assert.deepEqual(result?.closedQuestions, []);
});

test("строки сортируются по коду компетенции, типу, семестру, дисциплине и порядку пула", () => {
  const rows = fosRows([
    template("Языки", 2, { "УК-10": { openQuestions: "УК 10" }, "ОПК-10": { openQuestions: "Поздняя" }, "ПК-2": { closedQuestions: "Закрытый" } }),
    template("Базы", 1, { "ОПК-2": { openPool: [{ id: "a", text: "Первый" }, { id: "b", text: "Второй" }], closedQuestions: "Тест" }, "ТЕСТ-1": { openQuestions: "Иной код" } }),
    template("Языки", 2, { "ОПК-2": { openQuestions: "Третий" }, "УК-2": { openQuestions: "УК 2" } }),
  ]);
  assert.deepEqual(rows.map(({ competence, type, number, question }) => [competence, type, number, question]), [
    ["ОПК 2", "открытый", 1, "Первый"], ["ОПК 2", "открытый", 2, "Второй"], ["ОПК 2", "открытый", 3, "Третий"],
    ["ОПК 2", "закрытый", 1, "Тест"], ["ОПК 10", "открытый", 1, "Поздняя"], ["ПК 2", "закрытый", 1, "Закрытый"],
    ["ТЕСТ 1", "открытый", 1, "Иной код"], ["УК 2", "открытый", 1, "УК 2"], ["УК 10", "открытый", 1, "УК 10"],
  ]);
  assert.deepEqual(rows.slice(0, 4).map((row) => row.semester), [1, 1, 2, 1]);
  assert.deepEqual(fosRows([{ disciplins_name: null, semester: null, assessment_tools_questions: { competencies: { "Без кода": { openQuestions: "Текст" } } } }])[0].competence, "Без кода");
});

test("книга Excel содержит заключение, шапку, строки, закрепление и фильтр; пустой ФОС валиден", async () => {
  const rows = fosRows([template("Базы", 3, { "ОПК-1": { openPool: [{ id: "a", text: "Вопрос\nА) да", correctAnswer: "А" }] } })]);
  for (const dataRows of [rows, []]) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.read(Readable.from([await buildFosWorkbook({ direction: "09.03.01 Информатика", profile: "Разработка ПО", year: 2026, rows: dataRows })]));
    const sheet = workbook.getWorksheet("вопросы");
    assert.ok(sheet);
    assert.ok(sheet.model.merges?.includes("A1:G1"));
    assert.match(String(sheet.getCell("A1").value), /09\.03\.01 Информатика.*Разработка ПО/s);
    assert.match(String(sheet.getCell("A1").value), new RegExp(String(new Date().getFullYear())));
    assert.deepEqual(["A", "B", "C", "D", "E", "F", "G"].map((column) => sheet.getCell(`${column}2`).value), ["компетенция", "семестр", "тип вопроса", "номер", "вопрос", "правильный ответ", "дисциплина"]);
    assert.equal(sheet.getCell("E3").value, dataRows[0]?.question ?? null);
    assert.equal(sheet.getCell("B3").value, dataRows[0]?.semester ?? null);
    assert.equal(sheet.getCell("F3").value, dataRows[0]?.answer ?? null);
    assert.equal(sheet.views[0].state === "frozen" && "topLeftCell" in sheet.views[0] ? sheet.views[0].topLeftCell : null, "A3");
    assert.equal(sheet.autoFilter, `A2:G${Math.max(2, dataRows.length + 2)}`);
    assert.equal(sheet.getColumn("E").width, 43.1);
    assert.equal(sheet.getCell("A1").font.name, "Helvetica Neue");
    assert.ok((sheet.getRow(1).height ?? 0) >= 200);
    assert.equal(sheet.getCell("E3").alignment?.wrapText, dataRows.length > 0 ? true : undefined);
  }
});

test("список назначаемых преподавателей возвращает логин при пустом ФИО", async () => {
  const db = { query: async (sql: string) => sql.includes("SELECT is_active")
    ? { rows: [{ is_active: true }] }
    : { rows: [{ id: 5, name: "nofio", fullname: {} }, { id: 6, name: "withfio", fullname: { surname: "Иванов", name: "Иван" } }] },
  } as unknown as Pool;
  const users = await new TemplateWorkflow(db).assignableTeachers({ id: 1, role: USER_ROLES.ROP, userName: "rop" });
  assert.deepEqual(users, [{ id: 5, fullname: "nofio" }, { id: 6, fullname: "Иванов Иван" }]);
});

test("профиль дисциплины возвращает логин участника при пустом ФИО", async () => {
  const db = { query: async (sql: string) => {
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: 12 }] };
    if (sql.includes("FROM rpd_profile_templates rpt")) return { rows: [{ id: 12, field_edits: {} }] };
    return { rows: [{ userId: 5, name: "nofio", fullname: null, isActive: true }] };
  } } as unknown as Pool;
  const profile = await new RpdProfileTemplates(db).getJsonProfile(12);
  assert.deepEqual(profile?.teachers, [{ userId: 5, fullname: "nofio", isActive: true }]);
});

test("маршрут XLSX отдаёт файл с UTF-8 именем и 404 для неизвестного комплекта", async () => {
  const db = { query: async (sql: string, values: unknown[]) => {
    if (sql.includes("FROM rpd_complects")) {
      assert.deepEqual(values, ["test-uuid"]);
      return { rows: [{ id: 8, direction: "09.03.01", profile: "Разработка ПО", year: 2026 }] };
    }
    assert.deepEqual(values, [8]);
    return { rows: [template("Базы", 2, { "ОПК-1": { openQuestions: "Вопрос" } })] };
  } } as unknown as Pool;
  const headers = new Map<string, string>();
  let sent: unknown;
  const response = {
    setHeader: (key: string, value: string) => { headers.set(key, value); },
    send: (value: unknown) => { sent = value; },
  } as unknown as Response;
  await new RpdProfileTemplatesController(db).generateAssessmentFundsXlsx({ body: { complectId: "test-uuid" } } as Request, response);
  assert.equal(headers.get("Content-Type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(headers.get("Content-Disposition"), `attachment; filename*=UTF-8''${encodeURIComponent("ФОС Разработка ПО 2026.xlsx")}`);
  assert.ok(Buffer.isBuffer(sent));
  assert.equal(sent.subarray(0, 2).toString(), "PK");

  const missing = { query: async () => ({ rows: [] }) } as unknown as Pool;
  await assert.rejects(new RpdProfileTemplatesController(missing).generateAssessmentFundsXlsx({ body: { complectId: 99 } } as Request, response), { status: 404 });
});
