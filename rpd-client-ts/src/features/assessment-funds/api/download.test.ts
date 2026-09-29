import { describe, expect, it } from "vitest";
import { excelFilename } from "./download";

describe("excelFilename", () => {
  it("декодирует имя из Content-Disposition", () => {
    expect(
      excelFilename(
        "attachment; filename*=UTF-8''%D0%A4%D0%9E%D0%A1%20%D0%A2%D0%B5%D1%81%D1%82.xlsx"
      )
    ).toBe("ФОС Тест.xlsx");
  });

  it.each([undefined, "attachment", "filename*=UTF-8''%broken"])(
    "использует запасное имя при недоступном заголовке",
    (header) => expect(excelFilename(header)).toBe("ФОС.xlsx")
  );
});
