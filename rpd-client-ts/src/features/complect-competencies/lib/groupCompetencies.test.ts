import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  parseCsvToJson,
  type ParsedPlannedResults,
} from "@shared/ability/lib/parseCsvToJson";
import { groupCompetencies } from "./groupCompetencies";

const parseRows = (...rows: string[][]) =>
  Object.fromEntries(
    rows.map(([competence = "", indicator = "", results = ""], index) => [
      index,
      { competence, indicator, results },
    ])
  ) as ParsedPlannedResults;

describe("матрица компетенций", () => {
  it("связывает индикаторы и дисциплины с нужными компетенциями и убирает повторы", () => {
    expect(
      groupCompetencies(
        parseRows(
          ["УК 1", "", "Анализ"],
          ["", "УК-1.1", "Находит данные"],
          ["", "", "Математика"],
          ["", "", "Математика"],
          ["", "УК-1.2", "Оценивает данные"],
          ["", "", "Физика"],
          ["ОПК-2", "", "Разработка"],
          ["", "ОПК-2.1", "Создаёт решение"]
        )
      )
    ).toEqual([
      {
        competence: "УК-1. Анализ",
        indicator: "УК-1.1. Находит данные",
        disciplines: ["Математика"],
      },
      {
        competence: "УК-1. Анализ",
        indicator: "УК-1.2. Оценивает данные",
        disciplines: ["Физика"],
      },
      {
        competence: "ОПК-2. Разработка",
        indicator: "ОПК-2.1. Создаёт решение",
        disciplines: [],
      },
    ]);
  });

  it("сохраняет старый формат без индикаторов", () => {
    expect(
      groupCompetencies(
        parseRows(
          ["ПК-4", "", "Программирует"],
          ["", "", "Базы данных"],
          ["УК-1", "", "Анализирует"],
          ["", "", "Физика"]
        )
      )
    ).toEqual([
      {
        competence: "ПК-4. Программирует",
        indicator: "—",
        disciplines: ["Базы данных"],
      },
      {
        competence: "УК-1. Анализирует",
        indicator: "—",
        disciplines: ["Физика"],
      },
    ]);
  });

  it.each(
    [
      [],
      [["УК-1", "", "Анализ"]],
      [["", "УК-1.1", "Сирота"]],
      [["", "", "Сирота"]],
      [
        ["УК-1", "", "Анализ"],
        ["", "ПК-2.1", "Чужой индикатор"],
      ],
      [
        ["УК-1", "", "Анализ"],
        ["", "УК-1.1", "Верно"],
        ["ПК-2", "", ""],
      ],
      [
        ["УК-1", "", "Анализ"],
        ["", "УК-1.1", "Верно"],
        ["", "ошибка", "Неверный код"],
      ],
    ].map((rows) => ({ rows }))
  )("отклоняет целиком пустую или повреждённую матрицу $rows", ({ rows }) => {
    expect(() => groupCompetencies(parseRows(...rows))).toThrow();
  });
});

async function workbookFile(rows: string[][], sheet = "Компетенции") {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheet);
  worksheet.addRows([
    ["Компетенция", "Индикатор", "Код дисциплины", "Наименование"],
    ...rows,
  ]);
  const data = await workbook.xlsx.writeBuffer();
  return new File([new Uint8Array(data)], "матрица.xlsx");
}

describe("чтение XLSX", () => {
  it("читает настоящий новый XLSX с абсолютными индексами пустых ячеек", async () => {
    const file = await workbookFile([
      ["УК-1", "", "", "Анализ"],
      ["", "УК-1.1", "", "Находит данные"],
      ["", "", "Б1", "Физика"],
    ]);
    expect(groupCompetencies(await parseCsvToJson(file))).toEqual([
      {
        competence: "УК-1. Анализ",
        indicator: "УК-1.1. Находит данные",
        disciplines: ["Физика"],
      },
    ]);
  });
  it("читает старый XLSX со сдвинутым кодом компетенции", async () => {
    const file = await workbookFile([
      ["", "ПК-4", "", "Разработка", "ПК"],
      ["", "", "Б1", "Базы данных"],
    ]);
    expect(groupCompetencies(await parseCsvToJson(file))).toEqual([
      {
        competence: "ПК-4. Разработка",
        indicator: "—",
        disciplines: ["Базы данных"],
      },
    ]);
  });
  it("не пропускает компетенцию без названия после корректной строки", async () => {
    const file = await workbookFile([
      ["", "ПК-4", "", "Разработка"],
      ["", "", "Б1", "Базы данных"],
      ["", "УК-1", "", ""],
    ]);
    await expect(parseCsvToJson(file)).rejects.toThrow("наименование");
  });
  it("отклоняет файл без листа Компетенции", async () => {
    await expect(
      parseCsvToJson(await workbookFile([], "Лист1"))
    ).rejects.toThrow('Не найден лист "Компетенции"');
  });
});
