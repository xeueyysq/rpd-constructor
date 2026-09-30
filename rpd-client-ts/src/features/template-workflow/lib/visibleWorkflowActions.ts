import type { WorkflowAction } from "@entities/template";
import { UserRole } from "@shared/ability";

export function visibleWorkflowActions(
  allowedActions: readonly WorkflowAction[],
  mode: UserRole
): WorkflowAction[] {
  switch (mode) {
    case UserRole.TEACHER:
      return allowedActions.filter((action) =>
        ["start", "finish", "reopen"].includes(action)
      );
    case UserRole.ROP:
    case UserRole.ADMIN:
      return allowedActions.filter((action) =>
        ["accept", "refine"].includes(action)
      );
    default:
      return [];
  }
}

export function workflowActionsLayout(
  allowedActions: readonly WorkflowAction[],
  mode: UserRole
) {
  const visible = visibleWorkflowActions(allowedActions, mode);
  const priority: WorkflowAction[] =
    mode === UserRole.TEACHER ? ["start", "finish"] : ["accept", "refine"];
  const primary = priority.find((action) => visible.includes(action));

  return {
    primary,
    secondary: visible.filter((action) => action !== primary),
  };
}
