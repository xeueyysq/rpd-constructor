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

describe("Пересчёт часов и ЗЕТ (disciplineScope)", () => {
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
  test("некорректный код — пустая строка", () => {
    assert.equal(recordType.placeFromRecordType("xxx"), "");
  });
});

describe("Сравнение данных при синхронизации с 1С (complectSync)", () => {
  test("формирует форму аттестации по нагрузке контроля", () => {
    assert.equal(sync.deriveCertification({ "Экзамен": "да" }), "Экзамен");
    assert.equal(sync.deriveCertification({}), null);
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
  test("очищает поля, вычисляет ЗЕТ и часть учебного плана", () => {
    const result = normalizeDisciplineFrom1c({
      discipline: "  Программирование  ",
      semester: "1",
      division: "Кафедра ВМ",
      teachers: ["Иванов И.И."],
      record_type: "1.О",
      study_load: { "Всего": 72 },
    });
    assert.equal(result.discipline, "Программирование");
    assert.equal(result.department, "Кафедра ВМ");
    assert.equal(result.zet, 2);
    assert.equal(result.place, "обязательной части");
    assert.equal(result.semester, 1);
  });
});
