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

  it("делит на «из 1С» и остальных без автоматического выбора, неоднозначные ФИО выносит в справку", () => {
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
    expect(result.from1c.map((option) => [option.id, option.selected])).toEqual(
      [[2, false]]
    );
    expect(result.others.map((option) => [option.id, option.selected])).toEqual(
      [
        [1, true],
        [3, true],
      ]
    );
    expect(result.others[1]).toMatchObject({
      isActive: false,
      canAssign: false,
    });
    expect(result.unmatchedNames).toEqual(["Неоднозначное ФИО"]);
  });

  it("без преподавателей из 1С все аккаунты — остальные, по алфавиту", () => {
    const result = prepareTeacherOptions(users, participants, [], [], "");
    expect(result.from1c).toEqual([]);
    expect(result.unmatchedNames).toEqual([]);
    expect(result.others.map((option) => option.id)).toEqual([1, 3, 2]);
  });

  it("если все аккаунты указаны в 1С, остальных нет", () => {
    const result = prepareTeacherOptions(
      users,
      [],
      [],
      [
        { name: "Яковлева Тест Тестовна", userId: 2 },
        { name: "Альфина Тест Тестовна", userId: 1 },
      ],
      ""
    );
    expect(result.from1c.map((option) => option.id)).toEqual([1, 2]);
    expect(result.others).toEqual([]);
  });

  it("ищет ФИО без учёта регистра и пробелов вокруг запроса в обоих разделах", () => {
    const hints = [{ name: "Яковлева Тест Тестовна", userId: 2 }];
    expect(
      prepareTeacherOptions(users, participants, [1], hints, "  АЛЬФИНА ")
    ).toMatchObject({
      from1c: [],
      others: [expect.objectContaining({ id: 1, selected: true })],
    });
    expect(
      prepareTeacherOptions(users, participants, [], hints, "яковлева")
    ).toMatchObject({
      from1c: [expect.objectContaining({ id: 2 })],
      others: [],
    });
  });

  it("поиск фильтрует и справку «аккаунт не найден»", () => {
    const hints = [{ name: "Неоднозначное ФИО", userId: null }];
    expect(
      prepareTeacherOptions(users, participants, [], hints, "неодно")
        .unmatchedNames
    ).toEqual(["Неоднозначное ФИО"]);
    expect(
      prepareTeacherOptions(users, participants, [], hints, "альфина")
        .unmatchedNames
    ).toEqual([]);
  });

  it("закрывает состав в ready независимо от разрешения и учитывает запрет сервера", () => {
    expect(assignmentsDisabled("ready", true)).toBe(true);
    expect(assignmentsDisabled("ready", false)).toBe(true);
    expect(assignmentsDisabled("in_progress", false)).toBe(true);
    expect(assignmentsDisabled("unloaded", true)).toBe(false);
  });
});
