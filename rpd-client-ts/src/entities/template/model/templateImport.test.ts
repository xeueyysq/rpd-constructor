import { describe, expect, it } from "vitest";
import {
  fieldImportOptions,
  matchesImportSource,
  type ImportSourceComplect,
  type ImportSourceTemplate,
} from "./templateImport";

const template: ImportSourceTemplate = {
  id: 21,
  public_id: "source",
  disciplins_name: "Теория [систем]",
  semester: 3,
  record_type: "discipline",
  status: "created",
  participants: [
    { userId: 7, fullname: "Иванова Анна", state: "assigned", isActive: true },
  ],
};
const complect: ImportSourceComplect = {
  id: 2,
  uuid: "source-complect",
  faculty: "Институт",
  direction: "Информатика",
  profile: "Системы",
  year: 2026,
  education_form: "Очная",
  education_level: "Бакалавриат",
  templates: [template],
};
const target = {
  id: 10,
  disciplins_name: "Теория [систем]",
  direction: "Информатика",
  profile: "Системы",
  year: 2026,
};

describe("каталог источников импорта", () => {
  it("ищет буквальную подстроку дисциплины или преподавателя без fuzzy и regexp", () => {
    expect(matchesImportSource(template, "[СИСТЕМ]")).toBe(true);
    expect(matchesImportSource(template, "  ИВАНОВА  ")).toBe(true);
    expect(matchesImportSource(template, "Тр[ст]")).toBe(false);
    expect(matchesImportSource(template, ".*")).toBe(false);
    expect(matchesImportSource(template, "теоря")).toBe(false);
  });

  it("допускает черновик другого года и показывает реальные метаданные", () => {
    const options = fieldImportOptions(
      [{ ...complect, year: 2025 }],
      target,
      "year"
    );
    expect(options).toEqual([
      {
        id: 21,
        year: 2025,
        text: "Теория [систем] • семестр 3 • Информатика • Системы • 2025 • Очная • Бакалавриат",
      },
    ]);
  });

  it.each([2026, "2026"])(
    "исключает тот же год при годе цели %s в режиме другого года",
    (year) => {
      expect(
        fieldImportOptions([complect], { ...target, year }, "year")
      ).toEqual([]);
    }
  );

  it.each([
    { name: "  ТЕОРИЯ \t [СИСТЕМ]  ", ids: [21] },
    { name: "Алгебра", ids: [] },
    { name: "Теоря [систем]", ids: [] },
    { name: null, ids: [] },
  ])(
    "сопоставляет название $name другого года без fuzzy, с нормализацией регистра и пробелов",
    ({ name, ids }) => {
      const catalog = [
        {
          ...complect,
          year: 2025,
          templates: [{ ...template, disciplins_name: name }],
        },
      ];
      expect(
        fieldImportOptions(catalog, target, "year").map((option) => option.id)
      ).toEqual(ids);
    }
  );

  it.each([
    { sourceYear: null, targetYear: 2026 },
    { sourceYear: 2025, targetYear: null },
    { sourceYear: 2025, targetYear: undefined },
    { sourceYear: 2025, targetYear: "" },
    { sourceYear: 2025, targetYear: "  " },
    { sourceYear: 2025, targetYear: "неизвестен" },
  ])(
    "исключает неизвестный год источника $sourceYear или цели $targetYear",
    ({ sourceYear, targetYear }) => {
      expect(
        fieldImportOptions(
          [{ ...complect, year: sourceYear }],
          { ...target, year: targetYear },
          "year"
        )
      ).toEqual([]);
    }
  );

  it("допускает другое направление/profile того же года, независимо от названия дисциплины", () => {
    const catalog = [
      {
        ...complect,
        templates: [
          { ...template, id: 22, disciplins_name: "Другое название" },
        ],
      },
      {
        ...complect,
        id: 3,
        direction: "Математика",
        templates: [{ ...template, id: 23 }],
      },
      {
        ...complect,
        id: 4,
        profile: "Другой профиль",
        templates: [{ ...template, id: 24 }],
      },
    ];
    expect(
      fieldImportOptions(catalog, target, "direction").map(
        (option) => option.id
      )
    ).toEqual([23, 24]);
  });
});
