import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ParsedPlannedResults {
  [id: string]: {
    competence: string;
    indicator: string;
    results: string;
  };
}

const excelCellValueToString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();

  // ExcelJS can return rich objects for cells (richText, formula, hyperlink, etc.)
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;

    // { text: string }
    if (typeof v.text === "string") return v.text;

    // { richText: Array<{ text: string }> }
    if (Array.isArray(v.richText)) {
      return v.richText.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
    }

    // { formula: string, result: CellValue }
    if ("result" in v) return excelCellValueToString(v.result);
  }

  return String(value);
};

const normalizeCode = (value: string): string => value.replace(/[–—]/g, "-").replace(/\s+/g, "").toUpperCase();

// We intentionally keep these regexes *generic*.
// They are used only to:
// - detect structure (new vs old) by presence of indicator codes
// - find competence codes in old XLSX rows where columns may shift
//
// Examples we want to support:
// - УК-1, ОПК-2, ПК-10а
// - IND-3.1, ПК-2.3, ПК-2.3.1
//
// Prefix: 1..16 letters (Cyrillic/Latin), then "-", then number with optional letter suffix.
const competenceCodeRe = /^[A-ZА-ЯЁ]{1,16}-\d+[A-ZА-ЯЁ]*$/i;

// Indicator is competence code + one or more ".<number><optionalLetters>" segments.
const indicatorCodeRe = /^[A-ZА-ЯЁ]{1,16}-\d+[A-ZА-ЯЁ]*(\.\d+[A-ZА-ЯЁ]*)+$/i;

const parseCsvFile = (file: File): Promise<string[][]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        try {
          const rows = results.data as string[][];
          resolve(rows);
        } catch {
          reject(new Error("Ошибка при обработке CSV-файла"));
        }
      },
      encoding: "cp1251",
      delimiter: ";",
      error: () => {
        reject(new Error("Ошибка при чтении CSV-файла"));
      },
    });
  });
};

const parseXlsxFile = async (file: File): Promise<string[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet =
    workbook.worksheets.find((ws) => (ws.name ?? "").toString().trim().toLowerCase() === "компетенции") ?? null;
  if (!worksheet) {
    throw new Error('Не найден лист "Компетенции" в XLSX файле');
  }
  const rows: string[][] = [];

  // IMPORTANT:
  // `row.eachCell` iterates only over *existing* cells. When the first columns are empty (old structure),
  // it shifts indices and breaks mapping. We must read by absolute column index.
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const rowData: string[] = [];
    const columnCount = Math.max(worksheet.columnCount ?? 0, row.cellCount ?? 0);
    for (let c = 1; c <= columnCount; c++) {
      const cell = row.getCell(c);
      rowData.push(excelCellValueToString(cell.value));
    }
    rows.push(rowData);
  });

  return rows;
};

const buildParsedData = (rows: string[][]): ParsedPlannedResults => {
  const dataRows = rows.slice(1);
  const parsedData: ParsedPlannedResults = {};

  dataRows.forEach((row, index) => {
    const competence = (row[0] ?? "").toString().trim();
    const indicator = (row[1] ?? "").toString().trim();
    const results = (row[3] ?? "").toString().trim();

    if (!competence && !indicator && !results) {
      return;
    }

    parsedData[index] = {
      competence,
      indicator,
      results,
    };
  });

  if (Object.keys(parsedData).length === 0) {
    throw new Error("Данные не найдены");
  }

  return parsedData;
};

const detectStructureType = (rows: string[][]): "new" | "old" => {
  const dataRows = rows.slice(1);
  // New structure has indicator codes; old structure has NO indicators.
  const hasAnyIndicator = dataRows.some((row) =>
    row.some((cell) => {
      const s = (cell ?? "").toString().trim();
      if (!s) return false;
      return indicatorCodeRe.test(normalizeCode(s));
    })
  );
  if (hasAnyIndicator) return "new";

  const hasAnyCompetence = dataRows.some((row) =>
    row.some((cell) => {
      const s = (cell ?? "").toString().trim();
      if (!s) return false;
      return competenceCodeRe.test(normalizeCode(s));
    })
  );
  if (hasAnyCompetence) return "old";

  throw new Error("Данные не найдены или не удалось определить структуру файла");
};

const parseNewStructure = (rows: string[][]): ParsedPlannedResults => {
  return buildParsedData(rows);
};

const parseOldStructure = (rows: string[][]): ParsedPlannedResults => {
  const dataRows = rows.slice(1);
  const parsedData: ParsedPlannedResults = {};
  let idx = 0;

  dataRows.forEach((row) => {
    // Old structure (ТРПО):
    // - competence rows: ;УК-1;;<competence_text>;...
    // - discipline rows: ;;<discipline_code>;<discipline_name>;...
    // Indicators are not present.
    const cells = row.map((c) => (c ?? "").toString().trim());
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length === 0) return;

    const competenceIdx = cells.findIndex((c) => competenceCodeRe.test(normalizeCode(c)));
    const competenceCode = competenceIdx >= 0 ? normalizeCode(cells[competenceIdx]) : "";

    if (competenceCode) {
      // Some old-format files may contain a short trailing label (e.g. "УК") in the last column.
      // Exclude it by using the prefix of the detected competence code (part before "-").
      const competencePrefix = competenceCode.split("-")[0] ?? "";
      const competenceText = [...cells].reverse().find((c) => {
        if (!c) return false;
        const norm = normalizeCode(c);
        if (competencePrefix && norm === competencePrefix) return false;
        if (competenceCodeRe.test(norm)) return false;
        if (indicatorCodeRe.test(norm)) return false;
        return true;
      });
      if (!competenceText) return;

      parsedData[idx++] = {
        competence: competenceCode,
        indicator: "",
        results: competenceText,
      };
      return;
    }

    const disciplineText = nonEmpty[nonEmpty.length - 1];
    if (disciplineText) {
      parsedData[idx++] = {
        competence: "",
        indicator: "",
        results: disciplineText,
      };
    }
  });

  if (Object.keys(parsedData).length === 0) {
    throw new Error("Данные не найдены");
  }

  return parsedData;
};

export const parseCsvToJson = async (file: File): Promise<ParsedPlannedResults> => {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) {
    throw new Error("Не удалось определить тип файла");
  }

  if (extension === "csv") {
    const rows = await parseCsvFile(file);
    const structureType = detectStructureType(rows);
    return structureType === "new" ? parseNewStructure(rows) : parseOldStructure(rows);
  }

  if (extension === "xlsx" || extension === "xls") {
    const rows = await parseXlsxFile(file);
    const structureType = detectStructureType(rows);
    return structureType === "new" ? parseNewStructure(rows) : parseOldStructure(rows);
  }

  throw new Error("Поддерживаются только файлы форматов .csv и .xlsx");
};

/*

export const parseCsvToJson = (file: File) => {
  //   const file = event.target.files?.[0];
  //   if (!file) return;
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        try {
          const rows = results.data as string[][];
          const dataRows = rows.slice(1);

          const parsedData: ParsedPlannedResults = {};

          dataRows.forEach((row: string[], index: number) => {
            if (row.length >= 3) {
              parsedData[index] = {
                competence: row[0] || "",
                indicator: row[1] || "",
                results: row[3] || "",
              };
            }
          });

          if (Object.keys(parsedData).length === 0) {
            throw new Error("Данные не найдены");
          }

          // const filteredData = filterData(parsedData);
          // setData(filteredData);
          // return parsedData, "Данные успешно загружены";
          resolve(parsedData);
        } catch (error) {
          reject(new Error("Ошибка при обработке данных"));
        }
      },
      encoding: "cp1251",
      delimiter: ";",
      error: (error) => {
        reject(new Error("Ошибка при чтении файла"));
      },
    });
  });
};
*/
