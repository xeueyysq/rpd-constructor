import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { USER_ROLES } from "../app/models/constants.ts";
import { Conflict } from "../app/utils/Errors.ts";
import { allowedActions, decide, deriveStatus, statusChangedAt, type DecisionInput, type Participant } from "../app/modules/templateWorkflow.ts";
import TemplateWorkflow, { buildSnapshots } from "../app/services/TemplateWorkflow.ts";

const participants = (states: Array<Participant["state"] | [Participant["state"], boolean]>): Participant[] =>
  states.map((state, index) => ({ userId: index + 1, state: typeof state === "string" ? state : state[0], isActive: typeof state === "string" ? true : state[1] }));

const base = (changes: Partial<DecisionInput>): DecisionInput => ({ current: "on_teacher", participants: participants(["assigned", "assigned"]), action: "finish", actorId: 1, actorRole: USER_ROLES.TEACHER, canManage: false, userName: "Первый П.П.", ...changes });

test("готовность зависит от всех активных участников", () => {
  const firstStarted = decide(base({ action: "start" }));
  const first = decide(base({ current: firstStarted.status, participants: firstStarted.participants }));
  assert.equal(first.status, "in_progress");
  assert.deepEqual(first.participants.map((part) => part.state), ["done", "assigned"]);
  const secondStarted = decide(base({ current: first.status, participants: first.participants, actorId: 2, action: "start" }));
  assert.equal(decide(base({ current: secondStarted.status, participants: secondStarted.participants, actorId: 2 })).status, "ready");
  assert.equal(deriveStatus("in_progress", participants(["done", ["assigned", false]])), "ready");
  assert.equal(deriveStatus("in_progress", participants([["done", false]])), "created");
});

test("назначенный преподаватель может только взять РПД в работу", () => {
  for (const current of ["on_teacher", "in_progress", "on_refinement"] as const) {
    const assigned = participants(["assigned", current === "in_progress" ? "in_progress" : "assigned"]);
    assert.deepEqual(allowedActions(current, assigned, 1, false), ["start"]);
  }
});

test("finish из assigned возвращает Conflict", () => {
  for (const current of ["on_teacher", "in_progress", "on_refinement"] as const) {
    const assigned = participants(["assigned", current === "in_progress" ? "in_progress" : "assigned"]);
    assert.throws(() => decide(base({ current, participants: assigned })),
      (error: unknown) => error instanceof Conflict && error.status === 409 && error.error === "Недопустимый переход");
  }
});

test("снятие отметки позволяет снова завершить работу", () => {
  const reopened = decide(base({ current: "in_progress", participants: participants(["done", "assigned"]), action: "reopen" }));
  assert.equal(reopened.status, "in_progress");
  assert.equal(reopened.participants[0].state, "in_progress");
  assert.deepEqual(allowedActions(reopened.status, reopened.participants, 1, false), ["finish"]);
  const finished = decide(base({ current: reopened.status, participants: reopened.participants }));
  assert.equal(finished.status, "in_progress");
  assert.equal(finished.participants[0].state, "done");
  assert.deepEqual(allowedActions(finished.status, finished.participants, 1, false), ["reopen"]);
  assert.throws(() => decide(base({ current: finished.status, participants: finished.participants })), { status: 409 });
});

test("возврат требует комментарий и снимает готовность", () => {
  const ready = participants(["done", "done"]);
  assert.throws(() => decide(base({ current: "ready", participants: ready, action: "refine", actorRole: USER_ROLES.ROP, canManage: true })), { status: 422 });
  const refined = decide(base({ current: "ready", participants: ready, action: "refine", actorRole: USER_ROLES.ROP, canManage: true, comment: " Исправьте раздел " }));
  assert.equal(refined.status, "on_refinement");
  assert.deepEqual(refined.participants.map((part) => part.state), ["assigned", "assigned"]);
  assert.equal(refined.event.comment, "Исправьте раздел");
  for (const actorId of [1, 2]) {
    assert.deepEqual(allowedActions(refined.status, refined.participants, actorId, false), ["start"]);
    assert.throws(() => decide(base({ current: refined.status, participants: refined.participants, actorId })), { status: 409 });
  }
  const added = decide(base({ current: refined.status, participants: refined.participants, action: "assign", actorRole: USER_ROLES.ROP, canManage: true, targetUserId: 3, targetRole: USER_ROLES.TEACHER, targetIsActive: true }));
  assert.equal(added.status, "on_refinement");
  assert.equal(added.participants[2].state, "assigned");
});

test("ready запрещает менять состав", () => {
  for (const action of ["assign", "unassign"] as const) assert.throws(() => decide(base({ current: "ready", action, actorRole: USER_ROLES.ROP, canManage: true, targetUserId: 3, targetRole: USER_ROLES.TEACHER, targetIsActive: true })), { status: 409 });
});

test("снятие последнего участника возвращает created", () => {
  const result = decide(base({ participants: participants(["assigned"]), action: "unassign", actorRole: USER_ROLES.ROP, canManage: true, targetUserId: 1 }));
  assert.equal(result.status, "created");
});

test("роли, личные действия и досрочное принятие", () => {
  assert.throws(() => decide(base({ action: "accept" })), { status: 403 });
  assert.throws(() => decide(base({ action: "finish", actorId: 3, actorRole: USER_ROLES.ROP, canManage: true })), { status: 403 });
  assert.throws(() => decide(base({ action: "accept", participants: [], actorRole: USER_ROLES.ROP, canManage: true })), { status: 409 });
  const accepted = decide(base({ action: "accept", actorRole: USER_ROLES.ROP, canManage: true }));
  assert.equal(accepted.status, "ready");
  assert.deepEqual(accepted.participants.map((part) => part.state), ["assigned", "assigned"]);
  assert.deepEqual(allowedActions("ready", accepted.participants, 1, true), ["refine"]);
  assert.deepEqual(allowedActions("ready", accepted.participants, 1, false), []);
});

test("пакетные снимки сохраняют порядок участников и считают отсутствие статуса как created", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const snapshots = buildSnapshots(
    [10, 20, 30],
    [{ id_profile_template: 10, current_status: "on_teacher", history: [{ status: "on_teacher", date: "2025-01-01T00:00:00Z" }, { status: "on_teacher", date: "2025-01-02T00:00:00Z" }] }, { id_profile_template: 30, current_status: "ready", history: [] }],
    [
      { templateId: 10, userId: 2, state: "done", isActive: true, name: "second", fullname: { surname: "Второй", name: "Иван" }, updatedAt: now },
      { templateId: 20, userId: 4, state: "assigned", isActive: true, name: "nofio", fullname: {}, updatedAt: now },
      { templateId: 10, userId: 1, state: "assigned", isActive: false, name: "first", fullname: { surname: "Первый" }, updatedAt: now },
    ],
    new Set([10, 30]),
    2,
  );
  assert.deepEqual([...snapshots.keys()], [10, 20, 30]);
  assert.deepEqual(snapshots.get(10)?.participants.map((part) => part.userId), [2, 1]);
  assert.deepEqual(snapshots.get(10)?.progress, { done: 1, total: 1 });
  assert.equal(snapshots.get(10)?.participants[0].fullname, "Второй Иван");
  assert.equal(snapshots.get(20)?.participants[0].fullname, "nofio");
  assert.deepEqual(snapshots.get(10)?.allowedActions, ["assign", "unassign", "accept", "reopen"]);
  assert.equal(snapshots.get(20)?.status, "created");
  assert.equal(snapshots.get(20)?.canEditTeachers, false);
  assert.deepEqual(snapshots.get(30)?.allowedActions, ["refine"]);
  assert.equal(snapshots.get(30)?.canEditTeachers, false);
  assert.equal(snapshots.get(10)?.statusChangedAt, "2025-01-01T00:00:00.000Z");
  assert.equal(snapshots.get(20)?.statusChangedAt, null);
  assert.equal(snapshots.get(30)?.statusChangedAt, null);
});

test("дата статуса — первое событие последней непрерывной серии", () => {
  const first = { status: "on_teacher", date: "2025-01-01T03:00:00+03:00" };
  const repeated = { status: "on_teacher", date: "2025-01-02T00:00:00Z" };
  const ready = { status: "ready", date: "2025-01-03T00:00:00Z" };
  const returned = { status: "on_teacher", date: "2025-01-04T00:00:00Z" };
  assert.equal(statusChangedAt([first], "on_teacher"), "2025-01-01T00:00:00.000Z");
  assert.equal(statusChangedAt([first, repeated], "on_teacher"), "2025-01-01T00:00:00.000Z");
  assert.equal(statusChangedAt([first, repeated, ready, returned, { ...returned, date: "2025-01-05T00:00:00Z" }], "on_teacher"), "2025-01-04T00:00:00.000Z");
  assert.equal(statusChangedAt([{ status: "unloaded", date: "2025-01-06T00:00:00Z" }], "unloaded"), "2025-01-06T00:00:00.000Z");
});

test("пустая, повреждённая или расходящаяся с текущим статусом история не даёт дату", () => {
  const valid = { status: "created", date: "2025-01-01T00:00:00Z" };
  for (const history of [null, undefined, [], {}, "[]", [null], [42], [{}], [{ status: "created", date: "битая дата" }], [{ status: "created", date: null }], [{ ...valid, status: "битый статус" }], [null, valid]]) {
    assert.equal(statusChangedAt(history, "created"), null);
  }
  assert.equal(statusChangedAt([valid], "ready"), null);
});

test("снимки загружают историю всех шаблонов одним запросом", async () => {
  const calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  const db = { query: async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (sql.includes("FROM template_status")) return { rows: [
      { id_profile_template: 10, current_status: "created", history: [{ status: "created", date: "2025-01-01T00:00:00Z" }] },
      { id_profile_template: 20, current_status: "ready", history: [{ status: "ready", date: "2025-01-02T00:00:00Z" }] },
    ] };
    return { rows: [] };
  } } as unknown as Pool;
  const snapshots = await new TemplateWorkflow(db).snapshots(db, [10, 20], { id: 7, role: USER_ROLES.ROP, userName: "rop" }, true);
  assert.equal(snapshots.get(10)?.statusChangedAt, "2025-01-01T00:00:00.000Z");
  assert.equal(snapshots.get(20)?.statusChangedAt, "2025-01-02T00:00:00.000Z");
  const statusQueries = calls.filter(({ sql }) => sql.includes("FROM template_status"));
  assert.equal(statusQueries.length, 1);
  assert.match(statusQueries[0].sql, /SELECT\s+id_profile_template,current_status,history/);
  assert.deepEqual(statusQueries[0].values, [[10, 20]]);
});
