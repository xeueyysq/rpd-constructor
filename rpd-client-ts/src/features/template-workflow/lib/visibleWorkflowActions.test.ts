import type { WorkflowAction } from "@entities/template";
import { UserRole } from "@shared/ability";
import { describe, expect, it } from "vitest";
import {
  visibleWorkflowActions,
  workflowActionsLayout,
} from "./visibleWorkflowActions";

const mixedActions: WorkflowAction[] = [
  "assign",
  "unassign",
  "accept",
  "refine",
  "start",
  "finish",
  "reopen",
];

describe("действия РПД в активном режиме интерфейса", () => {
  it.each([
    { mode: UserRole.TEACHER, expected: ["start", "finish", "reopen"] },
    { mode: UserRole.ROP, expected: ["accept", "refine"] },
    { mode: UserRole.ADMIN, expected: ["accept", "refine"] },
    { mode: UserRole.ANONYMOUS, expected: [] },
  ])("фильтрует смешанный набор для режима $mode", ({ mode, expected }) => {
    expect(visibleWorkflowActions(mixedActions, mode)).toEqual(expected);
  });

  it("при assigned оставляет прямую отметку Готово в меню", () => {
    expect(
      workflowActionsLayout(
        ["assign", "finish", "accept", "start", "unassign"],
        UserRole.TEACHER
      )
    ).toEqual({ primary: "start", secondary: ["finish"] });
  });

  it("при in_progress делает Готово основным действием", () => {
    expect(
      workflowActionsLayout(["accept", "finish"], UserRole.TEACHER)
    ).toEqual({ primary: "finish", secondary: [] });
  });

  it("при done оставляет снятие отметки только в меню", () => {
    expect(
      workflowActionsLayout(["accept", "reopen"], UserRole.TEACHER)
    ).toEqual({ primary: undefined, secondary: ["reopen"] });
  });

  it("при ready не добавляет преподавателю личных действий", () => {
    expect(workflowActionsLayout(["refine"], UserRole.TEACHER)).toEqual({
      primary: undefined,
      secondary: [],
    });
  });

  it.each([UserRole.ROP, UserRole.ADMIN])(
    "делает управленческое действие основным для режима %s",
    (mode) => {
      expect(
        workflowActionsLayout(["assign", "start", "accept", "finish"], mode)
      ).toEqual({ primary: "accept", secondary: [] });
      expect(workflowActionsLayout(["refine"], mode)).toEqual({
        primary: "refine",
        secondary: [],
      });
    }
  );

  it.each([UserRole.TEACHER, UserRole.ROP, UserRole.ADMIN])(
    "не добавляет недоступные действия для режима %s",
    (mode) => {
      expect(workflowActionsLayout(["assign", "unassign"], mode)).toEqual({
        primary: undefined,
        secondary: [],
      });
      expect(workflowActionsLayout([], mode)).toEqual({
        primary: undefined,
        secondary: [],
      });
    }
  );
});
