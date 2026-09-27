import { describe, expect, it } from "vitest";
import { diffAssignments } from "./diffAssignments";
import { orderTeacherOptions } from "./orderTeacherOptions";

describe("назначение преподавателей", () => {
  it("сохраняет порядок новых назначений и удалений", () => {
    expect(diffAssignments([2, 1], [1, 3, 4])).toEqual({
      assign: [3, 4],
      unassign: [2],
    });
  });
  it("поднимает совпадения с 1С, не назначая их автоматически", () => {
    expect(
      orderTeacherOptions(
        [
          { id: 1, fullname: "Альфа" },
          { id: 2, fullname: "Бета" },
        ],
        [{ name: "Бета", userId: 2 }]
      ).map((user) => user.id)
    ).toEqual([2, 1]);
  });
});
