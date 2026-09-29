import { describe, expect, it } from "vitest";
import { sameValue } from "./sameValue";

describe("сравнение значений шаблона", () => {
  it("не зависит от порядка ключей вложенных объектов", () => {
    expect(
      sameValue(
        { b: [{ z: 1, a: 2 }], a: null },
        { a: null, b: [{ a: 2, z: 1 }] }
      )
    ).toBe(true);
  });

  it("сохраняет порядок элементов массива и замечает изменение", () => {
    expect(sameValue({ values: [1, 2] }, { values: [2, 1] })).toBe(false);
    expect(sameValue({ value: 1 }, { value: 2 })).toBe(false);
  });
});
