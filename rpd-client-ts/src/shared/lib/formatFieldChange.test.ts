import { describe, expect, it } from "vitest";
import {
  formatFieldChangeCell,
  formatFieldChangeLine,
  formatFieldChangeValue,
  getFieldLabel,
} from "./formatFieldChange";

describe("formatFieldChange", () => {
  it.each([
    ["discipline", "Дисциплина"],
    ["study_load", "Учебная нагрузка"],
    ["unknown_field", "unknown_field"],
  ])("название поля %s", (field, label) => {
    expect(getFieldLabel(field)).toBe(label);
  });

  it.each([
    [null, "—"],
    [undefined, "—"],
    [[], "—"],
    [["Иванов", "Петров"], "Иванов, Петров"],
    [{ hours: 72 }, '{"hours":72}'],
    [0, "0"],
    [false, "false"],
  ])("форматирует значение %j", (value, formatted) => {
    expect(formatFieldChangeLine("semester", value, "новое")).toBe(
      `Семестр: ${formatted} → новое`
    );
  });

  it("сохраняет неизвестное имя поля и пустое новое значение", () => {
    expect(formatFieldChangeLine("custom", "старое", null)).toBe(
      "custom: старое → —"
    );
  });

  it("форматирует одно значение без названия поля", () => {
    expect(formatFieldChangeValue(["Иванов", "Петров"])).toBe("Иванов, Петров");
    expect(formatFieldChangeValue(null)).toBe("—");
  });

  describe("ячейка таблицы изменений", () => {
    it("показывает название дисциплины у маркеров, а не JSON", () => {
      expect(formatFieldChangeCell("__new__", { discipline: "Физика" })).toBe(
        "Физика"
      );
      expect(formatFieldChangeCell("removed", { discipline: "Химия" })).toBe(
        "Химия"
      );
      expect(formatFieldChangeCell("__new__", null)).toBe("—");
    });

    it("не трогает объекты у обычных полей и маркеры без названия", () => {
      expect(formatFieldChangeCell("study_load", { discipline: "x" })).toBe(
        '{"discipline":"x"}'
      );
      expect(formatFieldChangeCell("removed", { discipline: 1 })).toBe(
        '{"discipline":1}'
      );
    });

    it("форматирует обычные значения как строки с переносимыми ФИО", () => {
      expect(formatFieldChangeCell("zet", 3)).toBe("3");
      expect(
        formatFieldChangeCell("teachers", ["Иванов И. И.", "Петров"])
      ).toBe("Иванов И. И., Петров");
    });
  });
});
