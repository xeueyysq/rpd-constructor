import { describe, expect, it } from "vitest";
import type { TemplateParticipant } from "@entities/template";
import {
  assignmentsDisabled,
  prepareTeacherOptions,
  selectedParticipants,
} from "./teacherSelection";

const participants: TemplateParticipant[] = [
  {
    userId: 1,
    fullname: "Альфина Тест Тестовна",
    state: "done",
    isActive: true,
    updatedAt: "",
  },
  {
    userId: 3,
    fullname: "Отключева Тест Тестовна",
    state: "assigned",
    isActive: false,
    updatedAt: "",
  },
];
const users = [
  { id: 1, fullname: "Альфина Тест Тестовна" },
  { id: 2, fullname: "Яковлева Тест Тестовна" },
];

describe("список и диалог преподавателей", () => {
  it("до создания показывает только локальный выбор, после — серверные отметки, включая неактивных", () => {
    expect(selectedParticipants(null, participants, users, [2])).toEqual([
      {
        userId: 2,
        fullname: "Яковлева Тест Тестовна",
        state: "assigned",
        isActive: true,
      },
    ]);
    expect(selectedParticipants(100, participants, users, [2])).toEqual(
      participants
    );
  });

  it("поднимает совпадение 1С без автоматического выбора и выносит неоднозначные ФИО в справку", () => {
    const result = prepareTeacherOptions(
      users,
      participants,
      [1, 3],
      [
        { name: "Яковлева Тест Тестовна", userId: 2 },
        { name: "Неоднозначное ФИО", userId: null },
      ],
      ""
    );
    expect(
      result.options.map((option) => [
        option.id,
        option.selected,
        option.from1c,
      ])
    ).toEqual([
      [2, false, true],
      [1, true, false],
      [3, true, false],
    ]);
    expect(result.options[2]).toMatchObject({
      isActive: false,
      canAssign: false,
    });
    expect(result.unmatchedNames).toEqual(["Неоднозначное ФИО"]);
  });

  it("ищет ФИО без учёта регистра и пробелов вокруг запроса", () => {
    expect(
      prepareTeacherOptions(users, participants, [1], [], "  АЛЬФИНА ").options
    ).toEqual([expect.objectContaining({ id: 1, selected: true })]);
  });

  it("закрывает состав в ready независимо от разрешения и учитывает запрет сервера", () => {
    expect(assignmentsDisabled("ready", true)).toBe(true);
    expect(assignmentsDisabled("ready", false)).toBe(true);
    expect(assignmentsDisabled("in_progress", false)).toBe(true);
    expect(assignmentsDisabled("unloaded", true)).toBe(false);
  });
});
