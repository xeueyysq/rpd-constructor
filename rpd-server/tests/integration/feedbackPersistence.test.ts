import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { pool } from "../../config/db.ts";
import { FeedbackOutbox, FeedbackService } from "../../app/services/Feedback.ts";
import type { UserClaims } from "../../app/types/express.ts";

assert.equal(process.env.DB_PORT, "5433", "Проверка разрешена только на синтетической БД 5433");
assert.ok(["localhost", "127.0.0.1"].includes(process.env.DB_HOST ?? "localhost"));

test("очередь сохраняет новую группу при позднем подтверждении старой аренды и паузу после сбоя", async () => {
  const nonce = randomUUID();
  const login = `fpg-${nonce.slice(0, 12)}`;
  const { rows: users } = await pool.query<{ id: number }>(
    "INSERT INTO users(name,password,role,fullname,is_active) VALUES($1,$2,2,$3,TRUE) RETURNING id",
    [login, "synthetic-unusable-password", { surname: "Синтетический", name: "Тест" }]);
  const actor: UserClaims = { id: users[0].id, role: 2, userName: login };
  const service = new FeedbackService();
  const outbox = new FeedbackOutbox();
  const makeEvent = (clientEventId: string) => ({ clientEventId, operation: "complect.sync", errorCode: "HTTP_500",
    status: 500, context: { clientRelease: nonce, route: "/api/complects/sync/apply" } });
  try {
    const first = await service.diagnostic(actor, makeEvent(randomUUID()));
    assert.equal(first.count, 1);
    const { rows: leased } = await pool.query<{ id: string; attempts: number }>(
      "UPDATE feedback_outbox SET state='leased',attempts=attempts+1,lease_until=now()+interval '1 minute' WHERE group_id=$1 RETURNING id::text,attempts",
      [first.id]);
    const lease = leased[0];
    assert.ok(lease);
    const next = await service.diagnostic(actor, makeEvent(randomUUID()));
    assert.equal(next.id, first.id);
    assert.equal(next.count, 2);
    await outbox.delivered(lease.id, lease.attempts, null);
    const pending = await pool.query<{ state: string; attempts: number }>(
      "SELECT state,attempts FROM feedback_outbox WHERE group_id=$1", [first.id]);
    assert.deepEqual(pending.rows, [{ state: "pending", attempts: lease.attempts }]);

    const { rows: renewed } = await pool.query<{ id: string; attempts: number }>(
      "UPDATE feedback_outbox SET state='leased',attempts=attempts+1,lease_until=now()+interval '1 minute' WHERE group_id=$1 RETURNING id::text,attempts",
      [first.id]);
    const newLease = renewed[0];
    assert.equal(newLease.id, lease.id);
    assert.equal((await outbox.payload(newLease.id))?.type, "diagnostic");
    await outbox.failed(lease.id, lease.attempts, "OLD_FAILURE", new Date(Date.now() + 60_000));
    const stillLeased = await pool.query<{ state: string; last_error: string | null }>(
      "SELECT state,last_error FROM feedback_outbox WHERE group_id=$1", [first.id]);
    assert.deepEqual(stillLeased.rows, [{ state: "leased", last_error: null }]);
    await outbox.delivered(newLease.id, newLease.attempts, null);
    const delivered = await pool.query<{ state: string }>(
      "SELECT state FROM feedback_outbox WHERE group_id=$1", [first.id]);
    assert.equal(delivered.rows[0].state, "delivered");

    const until = new Date(Date.now() + 240_000);
    await outbox.cooldown("PROVIDER_RATE_LIMIT", until);
    await service.diagnostic(actor, { ...makeEvent(randomUUID()), operation: "complect.create" });
    assert.ok((await new FeedbackOutbox().cooldownUntil())!.getTime() >= until.getTime() - 1000);
    const status = await pool.query<{ last_error: string }>(
      "SELECT last_error FROM feedback_delivery_control WHERE id=true");
    assert.equal(status.rows[0].last_error, "PROVIDER_RATE_LIMIT");

    const createReport = (clientReportId: string) => service.manual(actor, {
      clientReportId, goal: "Синтетическая цель", actual: "Синтетический результат", blocking: false,
      context: { clientRelease: nonce },
    }, { data: Buffer.from("synthetic-image"), mime: "image/png" });
    const screenshot = await createReport(randomUUID());
    const pendingOld = await createReport(randomUUID());
    const deliveredOld = await createReport(randomUUID());
    await pool.query("UPDATE feedback_reports SET created_at=now()-interval '31 days' WHERE id=$1", [screenshot.id]);
    await pool.query("UPDATE feedback_reports SET created_at=now()-interval '91 days' WHERE id=ANY($1::uuid[])",
      [[pendingOld.id, deliveredOld.id]]);
    await pool.query("UPDATE feedback_outbox SET state='delivered' WHERE report_id=$1", [deliveredOld.id]);
    await outbox.retention();
    const { rows: retained } = await pool.query<{ id: string; screenshot_size: number }>(
      "SELECT id,screenshot_size FROM feedback_reports WHERE id=ANY($1::uuid[]) ORDER BY id",
      [[screenshot.id, pendingOld.id, deliveredOld.id]]);
    assert.equal(retained.length, 2);
    assert.equal(retained.some((row) => row.id === deliveredOld.id), false);
    assert.equal(retained.find((row) => row.id === screenshot.id)?.screenshot_size, 0);
    assert.equal(retained.some((row) => row.id === pendingOld.id), true);
  } finally {
    await pool.query("DELETE FROM diagnostic_groups WHERE client_release=$1", [nonce]);
    await pool.query("DELETE FROM feedback_reports WHERE context->>'clientRelease'=$1", [nonce]);
    await pool.query("UPDATE feedback_delivery_control SET cooldown_until=NULL,last_error=NULL WHERE id=true");
    // Пользователь остаётся до удаления tmpfs-БД: параллельные тесты делают снимки всех users.
    await pool.end();
  }
});
