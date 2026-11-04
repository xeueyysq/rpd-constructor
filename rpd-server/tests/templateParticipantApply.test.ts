import test from "node:test";
import assert from "node:assert/strict";
import TemplateWorkflow from "../app/services/TemplateWorkflow.ts";
import { admin, rop, teacher, templateDatabase } from "./helpers/templateImportDatabase.ts";

test("Apply сохраняет выбранный набор и личные состояния, возвращает снимок и историю существующих assign/unassign", async () => {
  const db = templateDatabase();
  const workflow = new TemplateWorkflow(db.db);
  const assigned = await workflow.setParticipants(20, rop, [9, 8], [8]);
  assert.deepEqual(assigned.participants.map((p) => [p.userId, p.state]), [[8, "in_progress"], [9, "assigned"]]);
  assert.equal(assigned.status, "in_progress");
  assert.equal(assigned.canEditTeachers, true);
  assert.deepEqual(db.state.statuses[1].history.map((event) => (event as { action: string }).action), ["assign"]);
  const beforeConflict = structuredClone(db.state);
  await assert.rejects(workflow.setParticipants(20, rop, [8, 12], [8]), { status: 409 });
  assert.deepEqual(db.state, beforeConflict);
  const removed = await workflow.setParticipants(20, admin, [9], [9, 8]);
  assert.equal(removed.status, "on_teacher");
  assert.deepEqual(removed.participants.map((p) => p.userId), [9]);
  const empty = await workflow.setParticipants(20, rop, [], [9]);
  assert.equal(empty.status, "created");
  assert.deepEqual(empty.participants, []);
});

test("Apply проверяет все новые ID до записи: inactive/admin/missing и stale base атомарны", async () => {
  for (const invalid of [10, 11, 999]) {
    const db = templateDatabase();
    const before = structuredClone(db.state);
    await assert.rejects(new TemplateWorkflow(db.db).setParticipants(20, rop, [9, invalid], [8]), { status: invalid === 999 ? 404 : 422 });
    assert.deepEqual(db.state, before);
  }
  const db = templateDatabase();
  const workflow = new TemplateWorkflow(db.db);
  for (const [next, base] of [[[8, 8], [8]], [[8], undefined], [[8], [8, 8]], [["9"], [8]]] as const) await assert.rejects(workflow.setParticipants(20, rop, next, base), { status: 422 });
  const before = structuredClone(db.state);
  db.failWriteAt(2); // DELETE уже выполнен; INSERT падает — ни снятие, ни история не сохраняются.
  await assert.rejects(workflow.setParticipants(20, rop, [9], [8]), /synthetic write failure/);
  assert.deepEqual(db.state, before);
});

test("Apply: teacher, чужой ROP и ready отвергаются; no-op не пишет историю", async () => {
  const db = templateDatabase();
  const workflow = new TemplateWorkflow(db.db);
  const before = structuredClone(db.state);
  await assert.rejects(workflow.setParticipants(20, teacher, [8, 9], [8]), { status: 403 });
  await assert.rejects(workflow.setParticipants(10, rop, [9], []), { status: 403 });
  await workflow.setParticipants(20, rop, [8], [8]);
  assert.deepEqual(db.state, before);
  db.state.statuses[1].current_status = "ready";
  await assert.rejects(workflow.setParticipants(20, rop, [], [8]), { status: 409 });
});

test("один Apply может снять несколько участников, даже если промежуточный состав состоит из done", async () => {
  const db = templateDatabase();
  db.state.assignments[0].state = "assigned";
  db.state.assignments.push({ user_id: 9, template_id: 20, state: "done", updated_at: "2026-01-01" }, { user_id: 12, template_id: 20, state: "done", updated_at: "2026-01-01" });
  db.state.statuses[1].current_status = "in_progress";
  const result = await new TemplateWorkflow(db.db).setParticipants(20, rop, [], [12, 8, 9]);
  assert.equal(result.status, "created");
  assert.deepEqual(result.participants, []);
  assert.equal(db.state.statuses[1].history.length, 3);
});
