import { describe, expect, it } from "vitest";
import { formatFullName } from "./formatFullName";

describe("formatFullName", () => {
  it("собирает полное ФИО и убирает лишние пробелы", () => {
    expect(
      formatFullName({
        surname: " Иванов ",
        name: " Иван ",
        patronymic: " Петрович ",
      })
    ).toBe("Иванов Иван Петрович");
  });

  it.each(["", null, undefined])(
    "пропускает пустое или отсутствующее отчество (%s)",
    (patronymic) => {
      expect(
        formatFullName({ surname: "Иванов", name: "Иван", patronymic })
      ).toBe("Иванов Иван");
    }
  );

  it.each([null, undefined])("возвращает пустую строку для %s", (fullname) => {
    expect(formatFullName(fullname)).toBe("");
  });
});
