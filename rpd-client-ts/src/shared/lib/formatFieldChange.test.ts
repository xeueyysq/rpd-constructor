import { describe, expect, it } from "vitest";
import { formatFieldChangeLine, getFieldLabel } from "./formatFieldChange";

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
});
