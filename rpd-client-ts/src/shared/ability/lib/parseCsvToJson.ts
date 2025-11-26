import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedPlannedResults {
  [id: string]: {
    competence: string;
    indicator: string;
    results: string;
  };
}

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
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown as string[][];

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
  const hasAnyFirstColumnValue = dataRows.some((row) => (row[0] ?? "").toString().trim() !== "");
  return hasAnyFirstColumnValue ? "new" : "old";
};

const parseNewStructure = (rows: string[][]): ParsedPlannedResults => {
  return buildParsedData(rows);
};

const parseOldStructure = (rows: string[][]): ParsedPlannedResults => {
  const dataRows = rows.slice(1);
  const parsedData: ParsedPlannedResults = {};
  let idx = 0;

  dataRows.forEach((row) => {
    const competenceCode = (row[1] ?? "").toString().trim();
    const disciplineCode = (row[2] ?? "").toString().trim();
    const text = (row[3] ?? "").toString().trim();

    if (!competenceCode && !disciplineCode && !text) {
      return;
    }

    if (competenceCode && !disciplineCode && text) {
      parsedData[idx++] = {
        competence: competenceCode,
        indicator: "",
        results: text,
      };
      return;
    }

    if (!competenceCode && disciplineCode && text) {
      parsedData[idx++] = {
        competence: "",
        indicator: "",
        results: text,
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
