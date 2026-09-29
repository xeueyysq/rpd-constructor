import test from "node:test";
import assert from "node:assert/strict";
import { formatShortName, matchTeacherNames, normalizeName, splitNames } from "../app/modules/teacherNames.ts";

test("нормализация ФИО и краткая форма", () => {
  assert.equal(normalizeName("  СЁМИНА   А.   Б. "), "семина а б");
  assert.equal(formatShortName({ surname: "Сёмина", name: "Анна", patronymic: "Борисовна" }), "Сёмина А.Б.");
  assert.deepEqual(splitNames([" Сёмина Анна Борисовна, Иванов И.И. ", "Иванов И.И."]), ["Сёмина Анна Борисовна", "Иванов И.И."]);
});

test("совпадение по полному ФИО или инициалам только при однозначности", () => {
  const users = [
    { id: 1, fullname: { surname: "Семина", name: "Анна", patronymic: "Борисовна" } },
    { id: 2, fullname: { surname: "Иванов", name: "Игорь", patronymic: "Иванович" } },
    { id: 3, fullname: { surname: "Иванов", name: "Илья", patronymic: "Иванович" } },
  ];
  assert.deepEqual(matchTeacherNames(["СЁМИНА А.Б.", "Иванов И.И.", "Нет Н.Н."], users), [
    { name: "СЁМИНА А.Б.", userId: 1, ambiguous: false },
    { name: "Иванов И.И.", userId: null, ambiguous: true },
    { name: "Нет Н.Н.", userId: null, ambiguous: false },
  ]);
});
