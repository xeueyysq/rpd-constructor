import { describe, expect, it } from "vitest";
import { changedCleanFields, formatEdit, latestEdit } from "./fieldEdits";
import type { FieldEdits } from "../model/fieldEdits";

const edits: FieldEdits = {
  goals: {
    userId: 1,
    fullname: "Альфина Т.Т.",
    at: "2026-09-27T18:15:00.123456Z",
  },
  content: { userId: null, fullname: "1С", at: "2026-09-27T19:15:00.123456Z" },
};

describe("отметки о правках", () => {
  it("находит последнюю правку шаблона и выбранного раздела", () => {
    expect(latestEdit(edits)).toBe(edits.content);
    expect(latestEdit(edits, ["goals"])).toBe(edits.goals);
    expect(latestEdit(edits, ["missing"])).toBeUndefined();
  });

  it("форматирует имя и локальное время", () => {
    const date = new Date(edits.goals.at);
    expect(formatEdit(edits.goals)).toBe(
      `Альфина Т.Т., ${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
    );
  });

  it("пропускает грязный черновик даже при новой версии сервера", () => {
    expect(
      changedCleanFields({ goals: edits.goals }, edits, { content: 1 })
    ).toEqual([]);
    expect(changedCleanFields({}, edits, { goals: 2 })).toEqual(["content"]);
  });
});
