import { describe, expect, it } from "vitest";
import {
  describeHoursMismatches,
  getRowHours,
  hoursMatchPlan,
  hoursMismatches,
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
  describe("расхождения с учебным планом", () => {
    const sum = getRowHours({
      lectures: 0,
      seminars: 0,
      control: 36,
      independent_work: 0,
    });
    const plan = {
      all: 144,
      lectures: 34,
      seminars: 34,
      contact: 68,
      independent_work: 40,
      control: 36,
    };

    it("при полной разбивке перечисляет только несовпавшие категории в порядке таблицы", () => {
      const mismatches = hoursMismatches(sum, {
        ...plan,
        has_total: true,
        has_breakdown: true,
      });
      expect(mismatches.map(({ key }) => key)).toEqual([
        "all",
        "lectures",
        "seminars",
        "contact",
        "independent_work",
      ]);
      expect(describeHoursMismatches(mismatches)).toBe(
        "всего 36 из 144; лекции 0 из 34; практика 0 из 34; контактная работа 0 из 68; СРС 0 из 40"
      );
    });
    it("при только общем объёме сравнивает одно «всего»", () => {
      expect(
        hoursMismatches(sum, { ...plan, has_total: true, has_breakdown: false })
      ).toEqual([{ key: "all", actual: 36, planned: 144 }]);
    });
    it("без плановых данных расхождений нет", () => {
      const noPlan = { ...plan, has_total: false, has_breakdown: false };
      expect(hoursMismatches(sum, noPlan)).toEqual([]);
      expect(hoursMatchPlan(sum, noPlan)).toBe(true);
    });
    it("вручную изменённая категория сравнивается даже без данных 1С", () => {
      const noPlan = { ...plan, has_total: false, has_breakdown: false };
      expect(hoursMismatches(sum, noPlan, { lectures: true })).toEqual([
        { key: "lectures", actual: 0, planned: 34 },
      ]);
      expect(hoursMatchPlan(sum, noPlan, { lectures: true })).toBe(false);
    });
    it("совпавший план не даёт расхождений", () => {
      expect(
        hoursMismatches(sum, { ...sum, has_total: true, has_breakdown: true })
      ).toEqual([]);
    });
  });
});
