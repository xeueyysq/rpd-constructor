import { describe, expect, it } from "vitest";
import { normalizeContent } from "./normalizeContent";

describe("normalizeContent", () => {
  it("не сохраняет пустую добавленную строку", () => {
    expect(
      normalizeContent({
        "1": {
          theme: "",
          lectures: null,
          seminars: null,
          independent_work: null,
          competence: "",
          indicator: "",
          results: "",
        },
      })
    ).toEqual({});
  });

  it("сохраняет тему с нулевыми часами", () => {
    const content = {
      "1": {
        theme: "Тема",
        lectures: 0,
        seminars: 0,
        control: 0,
        independent_work: 0,
        competence: "",
        indicator: "",
        results: "",
      },
    };
    expect(normalizeContent(content)).toEqual(content);
  });
});
