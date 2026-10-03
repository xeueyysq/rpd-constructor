import type { WorkflowAction } from "@entities/template";
import { UserRole } from "@shared/ability";
import { describe, expect, it } from "vitest";
import { visibleWorkflowActions } from "./visibleWorkflowActions";

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

  it.each<{
    state: string;
    allowed: WorkflowAction[];
    expected: WorkflowAction[];
  }>([
    {
      state: "assigned",
      allowed: ["assign", "accept", "start"],
      expected: ["start"],
    },
    {
      state: "in_progress",
      allowed: ["accept", "finish"],
      expected: ["finish"],
    },
    { state: "done", allowed: ["accept", "reopen"], expected: ["reopen"] },
    { state: "ready", allowed: ["refine"], expected: [] },
  ])(
    "у преподавателя в отметке $state нет «Готово» до начала работы: $expected",
    ({ allowed, expected }) => {
      expect(visibleWorkflowActions(allowed, UserRole.TEACHER)).toEqual(
        expected
      );
    }
  );
});
