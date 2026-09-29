import test from "node:test";
import assert from "node:assert/strict";
import { USER_ROLES } from "../app/models/constants.ts";
import { allowedActions, decide, deriveStatus, type DecisionInput, type Participant } from "../app/modules/templateWorkflow.ts";
import { buildSnapshots } from "../app/services/TemplateWorkflow.ts";

const participants = (states: Array<Participant["state"] | [Participant["state"], boolean]>): Participant[] =>
  states.map((state, index) => ({ userId: index + 1, state: typeof state === "string" ? state : state[0], isActive: typeof state === "string" ? true : state[1] }));

const base = (changes: Partial<DecisionInput>): DecisionInput => ({ current: "on_teacher", participants: participants(["assigned", "assigned"]), action: "finish", actorId: 1, actorRole: USER_ROLES.TEACHER, canManage: false, userName: "Первый П.П.", ...changes });

test("готовность зависит от всех активных участников", () => {
  const first = decide(base({}));
  assert.equal(first.status, "in_progress");
  assert.equal(decide(base({ participants: first.participants, actorId: 2 })).status, "ready");
  assert.equal(deriveStatus("in_progress", participants(["done", ["assigned", false]])), "ready");
  assert.equal(deriveStatus("in_progress", participants([["done", false]])), "created");
});

test("возврат требует комментарий и снимает готовность", () => {
  const ready = participants(["done", "done"]);
  assert.throws(() => decide(base({ current: "ready", participants: ready, action: "refine", actorRole: USER_ROLES.ROP, canManage: true })), { status: 422 });
  const refined = decide(base({ current: "ready", participants: ready, action: "refine", actorRole: USER_ROLES.ROP, canManage: true, comment: " Исправьте раздел " }));
  assert.equal(refined.status, "on_refinement");
  assert.deepEqual(refined.participants.map((part) => part.state), ["assigned", "assigned"]);
  assert.equal(refined.event.comment, "Исправьте раздел");
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
});

test("пакетные снимки сохраняют порядок участников и считают отсутствие статуса как created", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const snapshots = buildSnapshots(
    [10, 20, 30],
    [{ id_profile_template: 10, current_status: "on_teacher" }, { id_profile_template: 30, current_status: "ready" }],
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
});
