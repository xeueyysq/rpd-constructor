import { describe, expect, it } from "vitest";
import { addBooks } from "./bookList";

describe("addBooks", () => {
  it("не добавляет существующие и повторные описания", () => {
    const current = ["Кормен. Алгоритмы — 2004"];
    expect(
      addBooks(current, [
        " Кормен. Алгоритмы — 2004 ",
        "Кормен. Алгоритмы — 2010",
        "Кормен. Алгоритмы — 2010",
        " ",
      ])
    ).toEqual(["Кормен. Алгоритмы — 2004", "Кормен. Алгоритмы — 2010"]);
  });

  it("возвращает прежний массив, когда добавлять нечего", () => {
    const current = ["Описание"];
    expect(addBooks(current, [" Описание ", " "])).toBe(current);
  });
});
