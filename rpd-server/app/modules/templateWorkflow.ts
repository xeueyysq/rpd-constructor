import { Conflict, Forbidden, Unprocessable } from "../utils/Errors.ts";
import { USER_ROLES } from "../models/constants.ts";

export type TemplateStatus = "unloaded" | "created" | "on_teacher" | "in_progress" | "ready" | "on_refinement";
export type ParticipationState = "assigned" | "in_progress" | "done";
export type WorkflowAction = "assign" | "unassign" | "start" | "finish" | "reopen" | "accept" | "refine";
export type Participant = { userId: number; state: ParticipationState; isActive: boolean };
export type WorkflowEvent = { date: string; status: TemplateStatus; user: string; userId: number; action: WorkflowAction; targetUserId?: number; comment?: string };
export type DecisionInput = { current: TemplateStatus; participants: Participant[]; action: WorkflowAction; actorId: number; actorRole: number; canManage: boolean; userName: string; targetUserId?: number; targetIsActive?: boolean; targetRole?: number; comment?: string; date?: string };

export function statusChangedAt(history: unknown, current: string | null): string | null {
  if (!Array.isArray(history) || !history.length) return null;
  const entries: unknown[] = history;
  const events: Array<{ status: string; date: string }> = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || !("status" in entry) || !("date" in entry)) return null;
    if (typeof entry.status !== "string" || !["unloaded", "created", "on_teacher", "in_progress", "ready", "on_refinement"].includes(entry.status)) return null;
    if (typeof entry.date !== "string" || !Number.isFinite(Date.parse(entry.date))) return null;
    events.push({ status: entry.status, date: entry.date });
  }
  let first = events.length - 1;
  if (events[first].status !== current) return null;
  while (first > 0 && events[first - 1].status === current) first--;
  return new Date(events[first].date).toISOString();
}

export function deriveStatus(current: TemplateStatus, participants: Participant[]): TemplateStatus {
  if (current === "ready") return "ready";
  const active = participants.filter((participant) => participant.isActive);
  if (!active.length) return "created";
  if (active.every((participant) => participant.state === "done")) return "ready";
  if (current === "on_refinement" && active.every((participant) => participant.state === "assigned")) return "on_refinement";
  if (active.some((participant) => participant.state !== "assigned")) return "in_progress";
  return "on_teacher";
}

export function allowedActions(current: TemplateStatus, participants: Participant[], actorId: number, canManage: boolean): WorkflowAction[] {
  const actions: WorkflowAction[] = [];
  if (canManage) {
    if (current === "ready") actions.push("refine");
    else {
      actions.push("assign", "unassign");
      if (["on_teacher", "in_progress", "on_refinement"].includes(current) && participants.some((part) => part.isActive)) actions.push("accept");
    }
  }
  const own = participants.find((part) => part.userId === actorId && part.isActive);
  if (own && current !== "ready") {
    if (own.state === "assigned") actions.push("start");
    if (own.state === "in_progress") actions.push("finish");
    if (own.state === "done") actions.push("reopen");
  }
  return actions;
}

export function decide(input: DecisionInput): { participants: Participant[]; status: TemplateStatus; event: WorkflowEvent } {
  const { action, actorId, current } = input;
  const participants = input.participants.map((part) => ({ ...part }));
  const managerAction = ["assign", "unassign", "accept", "refine"].includes(action);
  if (managerAction && (!input.canManage || ![USER_ROLES.ADMIN, USER_ROLES.ROP].includes(input.actorRole))) throw new Forbidden("Нет доступа к действию");
  if (current === "ready" && action !== "refine") throw new Conflict("Сначала верните РПД на доработку");
  if (action === "assign" || action === "unassign") {
    if (!Number.isInteger(input.targetUserId)) throw new Unprocessable("Не указан userId");
    const index = participants.findIndex((part) => part.userId === input.targetUserId);
    if (action === "assign") {
      if (!input.targetIsActive || ![USER_ROLES.TEACHER, USER_ROLES.ROP].includes(input.targetRole ?? -1)) throw new Unprocessable("Пользователь неактивен или не является преподавателем");
      if (index !== -1) throw new Conflict("Преподаватель уже назначен");
      participants.push({ userId: input.targetUserId!, state: "assigned", isActive: true });
    } else {
      if (index === -1) throw new Conflict("Преподаватель не назначен");
      participants.splice(index, 1);
    }
  } else if (action === "accept") {
    if (!["on_teacher", "in_progress", "on_refinement"].includes(current) || !participants.some((part) => part.isActive)) throw new Conflict("РПД нельзя принять");
  } else if (action === "refine") {
    if (current !== "ready") throw new Conflict("РПД не готова");
    if (!input.comment?.trim()) throw new Unprocessable("Укажите комментарий");
    for (const part of participants) if (part.state === "done") part.state = "assigned";
  } else {
    const own = participants.find((part) => part.userId === actorId && part.isActive);
    if (!own) throw new Forbidden("Преподаватель не назначен или неактивен");
    const valid = action === "start" && own.state === "assigned" || action === "finish" && own.state === "in_progress" || action === "reopen" && own.state === "done";
    if (!valid) throw new Conflict("Недопустимый переход");
    own.state = action === "finish" ? "done" : "in_progress";
  }
  const status = action === "accept" ? "ready" : action === "refine" ? "on_refinement" : deriveStatus(current, participants);
  const event: WorkflowEvent = { date: input.date ?? new Date().toISOString(), status, user: input.userName, userId: actorId, action };
  if (action === "assign" || action === "unassign") event.targetUserId = input.targetUserId;
  if (action === "refine") event.comment = input.comment!.trim();
  return { participants, status, event };
}
