// Модульные тесты чистых функций подсистемы актуализации РПД.
// Запуск (из каталога rpd-server):  node --test tests/unit.test.ts
// Зависимости не требуются — используется встроенный тест-раннер Node.js (node:test).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import * as scope from "../app/modules/disciplineScope.ts";
import * as recordType from "../app/modules/disciplineRecordType.ts";
import * as sync from "../app/modules/complectSync.ts";
import * as spec from "../app/modules/specProfilesMapping.ts";
import { normalizeDisciplineFrom1c } from "../app/modules/normalizeDisciplineFrom1c.ts";
import { formatDisciplineName } from "../app/modules/disciplineNames.ts";

test("отображение названий меняет только полностью прописные, начиная с первой буквы", () => {
  const cases: Array<[string | null | undefined, string | null | undefined]> = [
    ["ВВЕДЕНИЕ В ПРОГРАММИРОВАНИЕ", "Введение в программирование"],
    ["  «1. БАЗЫ ДАННЫХ»", "  «1. Базы данных»"],
    ["Базы данных и SQL", "Базы данных и SQL"],
    ["введение в программирование", "введение в программирование"],
    ["123 —", "123 —"],
    ["", ""],
    ["   ", "   "],
    [null, null],
    [undefined, undefined],
  ];
  for (const [source, expected] of cases) assert.equal(formatDisciplineName(source), expected);
});

describe("Пересчёт часов и ЗЕТ (disciplineScope)", () => {
  test("выводит форму аттестации из меток и затем из контроля", () => {
    assert.equal(scope.deriveCertification([{ name: "Экзамен", id: "36" }], { "Зачет": 1 }), "Зачет");
    assert.equal(scope.deriveCertification([{ name: "Зачет с оценкой" }], {}), "Зачет с оценкой");
    assert.equal(scope.deriveCertification({ "Зачет": 4 }, {}), "Зачет");
    assert.equal(scope.deriveCertification([], { "Экзамен": 1 }), "Экзамен");
    assert.equal(scope.deriveCertification([], {}), null);
  });
  test("учитывает все формы контроля независимо от порядка ключей и часов", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ "Курсовая работа": 0, "Экзамен": 36 }, "Экзамен + курсовая работа"],
      [{ "Курсовая работа": 0, "Зачет": 0 }, "Зачет + курсовая работа"],
      [{ "Курсовая работа": 0, "Зачет с оценкой": 0 }, "Зачет с оценкой + курсовая работа"],
      [{ "Курсовой проект": 0, "Экзамен": 36 }, "Экзамен + курсовой проект"],
      [{ "Курсовая работа": 0 }, "Курсовая работа"],
      [{ "Курсовой проект": 0 }, "Курсовой проект"],
    ];
    for (const [control, expected] of cases) {
      assert.equal(scope.deriveCertification([], control), expected);
      assert.equal(scope.deriveCertification([], Object.fromEntries(Object.entries(control).reverse())), expected);
    }
    assert.equal(scope.deriveCertification({ "Зачет": 0 }, {}), "Зачет");
  });
  test("сохраняет ручную и неоднозначную сохранённую форму, но обновляет подтверждённую системную", () => {
    const load = { "Курсовая работа": 0, "Экзамен": 36 };
    assert.equal(scope.resolveEffectiveCertification("Авторская форма", {}, {}, load), "Авторская форма");
    assert.equal(scope.resolveEffectiveCertification("Зачет", {}, {}, load), "Зачет");
    assert.equal(scope.resolveEffectiveCertification("Зачет", { certification: { userId: 7 } }, {}, load), "Зачет");
    assert.equal(scope.resolveEffectiveCertification("Зачет", { certification: { userId: null } }, {}, load), "Экзамен + курсовая работа");
    assert.equal(scope.resolveEffectiveCertification(null, {}, {}, load), "Экзамен + курсовая работа");
  });
  test("извлекает суммарную учебную нагрузку из учебного плана", () => {
    assert.equal(scope.extractTotalAcademicHours({ "Лекции": 30, "Практика": 20, "Всего": 50 }), 50);
  });
  test("вычисляет ЗЕТ из часов (делитель 36)", () => {
    assert.equal(scope.computeZetFromHours(36), 1);
    assert.equal(scope.computeZetFromHours(72), 2);
  });
  test("определяет ЗЕТ по учебной нагрузке", () => {
    assert.equal(scope.resolveZetFromStudyLoad({ "Всего": 72 }, null), 2);
  });
});

describe("Определение части учебного плана (disciplineRecordType)", () => {
  test("«1.О» — обязательная часть", () => {
    assert.equal(recordType.placeFromRecordType("1.О"), "обязательной части");
  });
  test("«2.В» — часть, формируемая участниками", () => {
    assert.equal(recordType.placeFromRecordType("2.В"), "части, формируемой участниками образовательных отношений");
  });
  test("«Б1.О» — обязательная часть", () => {
    assert.equal(recordType.placeFromRecordType("Б1.О.23"), "обязательной части");
  });
  test("«Б1.В» — часть, формируемая участниками", () => {
    assert.equal(recordType.placeFromRecordType("Б1.В.05"), "части, формируемой участниками образовательных отношений");
  });
  test("практики Б2.О и Б2.В сохраняют прежнее определение части", () => {
    assert.equal(recordType.placeFromRecordType("Б2.О.02"), "обязательной части");
    assert.equal(recordType.placeFromRecordType("Б2.В.01"), "части, формируемой участниками образовательных отношений");
    assert.equal(recordType.placeFromRecordType("Б2.В.03"), "части, формируемой участниками образовательных отношений");
  });
  test("некорректный код — пустая строка", () => {
    assert.equal(recordType.placeFromRecordType("xxx"), "");
    assert.equal(recordType.placeFromRecordType("К.М.08.02"), "");
  });
});

describe("Сравнение данных при синхронизации с 1С (complectSync)", () => {
  test("пустой выбор не запускает применение; список полей не включает workflow", () => {
    assert.equal(sync.hasSyncSelections([]), false);
    assert.equal(sync.hasSyncSelections([{ action: "update" }]), true);
    assert.equal(sync.SYNC_FIELDS.includes("current_status"), false);
    assert.equal(sync.SYNC_FIELDS.includes("teacher_templates"), false);
    assert.equal(sync.TEMPLATE_SYNC_FIELDS.has("current_status"), false);
    assert.equal(sync.TEMPLATE_SYNC_FIELDS.has("teacher_templates"), false);
  });
  test("находит изменённое поле при сравнении локальных и актуальных данных", () => {
    assert.deepEqual(sync.diffFields({ zet: 3 }, { zet: 4 }), [{ field: "zet", old: 3, new: 4 }]);
  });
  test("не выдаёт изменений при совпадении данных", () => {
    assert.deepEqual(sync.diffFields({ zet: 4 }, { zet: 4 }), []);
  });
});

describe("Нормализация справочных данных (specProfilesMapping)", () => {
  test("приводит наименование к каноническому виду", () => {
    assert.equal(spec.normalizeName("  Информатика  И  ВТ "), "информатика и вт");
  });
  test("извлекает код направления", () => {
    assert.equal(spec.normalizeCode("09.03.01 Информатика и вычислительная техника"), "09.03.01");
  });
  test("устойчивая сериализация не зависит от порядка ключей", () => {
    assert.equal(spec.stableSerialize({ b: 2, a: 1 }), spec.stableSerialize({ a: 1, b: 2 }));
  });
});

describe("Нормализация дисциплины из 1С (normalizeDisciplineFrom1c)", () => {
  test("учитывает часы экзамена при пересчёте ЗЕТ из реальной нагрузки 1С", () => {
    const result = normalizeDisciplineFrom1c({
      study_load: { "СРС": 40, "Лекции": 34, "Практические": 34 },
      control_load: { "Экзамен": 36 },
      zets: 36,
    });
    assert.equal(result.zet, 4);
    assert.equal(scope.getStudyPlanHours(result.study_load, result.control_load).all, 144);
  });
  test("очищает поля, вычисляет ЗЕТ и часть учебного плана", () => {
    const result = normalizeDisciplineFrom1c({
      discipline: "  Программирование  ",
      semester: "1",
      division: "Кафедра ВМ",
      teachers: ["Иванов И.И."],
      record_type: "Б1.О.01",
      study_load: { "Всего": 72 },
    });
    assert.equal(result.discipline, "Программирование");
    assert.equal(result.department, "Кафедра ВМ");
    assert.equal(result.zet, 2);
    assert.equal(result.place, "обязательной части");
    assert.equal(result.semester, 1);
  });
  test("берёт явную часть из 1С, не изменяя индекс модуля", () => {
    const result = normalizeDisciplineFrom1c({ record_type: "К.М.08.02", place: " Б1.В " });
    assert.equal(result.place, "части, формируемой участниками образовательных отношений");
    assert.equal(result.record_type, "К.М.08.02");
    assert.equal(normalizeDisciplineFrom1c({ record_type: "К.М.08.02", place: " " }).place, "");
    assert.equal(normalizeDisciplineFrom1c({ record_type: "К.М.08.02", place: "К.М.08.02" }).place, "");
    assert.equal(normalizeDisciplineFrom1c({ record_type: "Б1.О.23", place: "обязательная часть" }).place, "обязательной части");
    assert.equal(normalizeDisciplineFrom1c({ record_type: "Б1.В.05", place: "" }).place, "части, формируемой участниками образовательных отношений");
  });
});
