import { describe, expect, it } from "vitest";
import {
  getRowHours,
  hoursMatchPlan,
  parseHours,
  sumContentHours,
} from "./hours";

describe("часы содержания дисциплины", () => {
  it("считает контактную работу без контроля и общий объём с контролем", () => {
    const row = getRowHours({
      lectures: 68,
      seminars: 68,
      control: 27,
      independent_work: 89,
    });
    expect(row.contact).toBe(136);
    expect(row.all).toBe(252);
    expect(
      sumContentHours({
        "1": {
          theme: "Тема",
          lectures: 68,
          seminars: 68,
          control: 27,
          independent_work: 89,
          competence: "",
          indicator: "",
          results: "",
        },
      })
    ).toEqual(row);
  });
  it("принимает десятичную запятую, пробелы и пустые значения", () => {
    expect(parseHours(" 17,5 ")).toBe(17.5);
    expect(
      getRowHours({
        lectures: "17,5",
        seminars: null,
        control: "",
        independent_work: undefined,
      })
    ).toMatchObject({ contact: 17.5, all: 17.5, control: 0 });
  });
  it("сравнивает только доступные или изменённые категории", () => {
    const sum = getRowHours({
      lectures: 68,
      seminars: 68,
      control: 27,
      independent_work: 89,
    });
    expect(
      hoursMatchPlan(sum, { ...sum, has_total: true, has_breakdown: true })
    ).toBe(true);
    expect(
      hoursMatchPlan(sum, {
        ...sum,
        control: 0,
        has_total: true,
        has_breakdown: true,
      })
    ).toBe(false);
    expect(
      hoursMatchPlan(sum, {
        ...sum,
        control: 0,
        has_total: true,
        has_breakdown: false,
      })
    ).toBe(true);
    expect(
      hoursMatchPlan(
        sum,
        {
          ...sum,
          control: 0,
          has_total: false,
          has_breakdown: false,
        },
        { control: true }
      )
    ).toBe(false);
    expect(
      hoursMatchPlan(sum, {
        ...sum,
        control: 0,
        has_total: false,
        has_breakdown: false,
      })
    ).toBe(true);
  });
});
