import { describe, expect, it } from "vitest";
import { mapComplectResultsToPlannedResults } from "./mapPlannedResultsFromComplect";

describe("mapComplectResultsToPlannedResults", () => {
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
