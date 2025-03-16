import Papa from "papaparse";

export interface ParsedPlannedResults {
  [id: string]: {
    competence: string;
    indicator: string;
    results: string;
  };
}

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
