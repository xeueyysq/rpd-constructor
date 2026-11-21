import { describe, expect, it } from "vitest";
import {
  hasPlannedResultsData,
  mapComplectResultsToPlannedResults,
} from "./mapPlannedResultsFromComplect";
import type { PlannedResultsData } from "../model/types";

describe("mapComplectResultsToPlannedResults", () => {
  it("подставляет матрицу для null и пустых строк, сохраняя любое заполненное поле", () => {
    const empty = {
      competence: "",
      indicator: "",
      results: { know: "", beAble: "", own: "" },
    };
    const blank: Array<PlannedResultsData | null | undefined> = [
      undefined,
      null,
      {},
      { 0: empty },
    ];
    for (const value of blank) expect(hasPlannedResultsData(value)).toBe(false);
    for (const row of [
      { ...empty, competence: "УК-1" },
      { ...empty, indicator: "УК-1.1" },
      ...["know", "beAble", "own"].map((key) => ({
        ...empty,
        results: { ...empty.results, [key]: "Сохранённый результат" },
      })),
    ])
      expect(hasPlannedResultsData({ 0: row })).toBe(true);
  });
  it.each([
    ["ВВЕДЕНИЕ В ПРОГРАММИРОВАНИЕ", "Введение в программирование"],
    ["Введение в программирование", "ВВЕДЕНИЕ В ПРОГРАММИРОВАНИЕ"],
    ["  введение в программирование  ", " Введение в программирование "],
  ])("сопоставляет %s с %s, сохраняя порядок и группировку", (name, source) => {
    const rows = [
      { competence: "УК-1", indicator: "УК-1.1", disciplines: [source] },
      { competence: "УК-2", indicator: "Чужой", disciplines: ["Математика"] },
      { competence: "УК-1", indicator: "УК-1.2", disciplines: [source] },
      { competence: "ОПК-2", indicator: "ОПК-2.1", disciplines: [source] },
    ];

    expect(mapComplectResultsToPlannedResults(rows, name)).toEqual({
      0: {
        competence: "УК-1",
        indicator: "УК-1.1",
        results: { know: "", beAble: "", own: "" },
      },
      1: {
        competence: "",
        indicator: "УК-1.2",
        results: { know: "", beAble: "", own: "" },
      },
      2: {
        competence: "ОПК-2",
        indicator: "ОПК-2.1",
        results: { know: "", beAble: "", own: "" },
      },
    });
  });

  it.each(["", "   ", "Математика"])(
    "не привязывает компетенции к пустому или чужому названию %s",
    (name) => {
      expect(
        mapComplectResultsToPlannedResults(
          [
            {
              competence: "УК-1",
              indicator: "УК-1.1",
              disciplines: ["", "   ", "Программирование"],
            },
          ],
          name
        )
      ).toEqual({});
    }
  );
});
