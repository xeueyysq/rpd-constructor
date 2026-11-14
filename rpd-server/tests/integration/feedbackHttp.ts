// Full server HTTP + synthetic PostgreSQL proof. The E2E runner starts the normal server.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import { pool } from "../../config/db.ts";
import TokenService from "../../app/services/Token.ts";
import type { UserClaims } from "../../app/types/express.ts";
import { feedbackDiagnostics, markFeedbackFailure } from "../../app/middleware/feedbackDiagnostics.ts";
import feedbackRouter from "../../app/routes/feedback.ts";
import { ErrorUtils } from "../../app/utils/Errors.ts";

assert.equal(process.env.DB_PORT, "5433", "Проверка разрешена только на синтетической БД 5433");
assert.ok(["localhost", "127.0.0.1"].includes(process.env.DB_HOST ?? "localhost"));
const api = process.env.API_URL;
assert.ok(api?.startsWith("http://localhost:8010") || api?.startsWith("http://127.0.0.1:8010"));

type Fixture = { id: number; token: string };
type Receipt = { id: string; code: string; warning?: string };
const nonce = randomUUID();
const created: number[] = [];
let reportId: string | undefined;
let ownHttp413Group: { id: string; requestId: string } | undefined;

async function fixture(role: number, active = true, stale = false): Promise<Fixture> {
  const name = `fb-${nonce.slice(0, 7)}-${created.length}`;
  const { rows } = await pool.query<{ id: number }>(
    "INSERT INTO users(name,password,role,fullname,is_active) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [name, "synthetic-unusable-password", role, { surname: "Синтетический", name: "Тест" }, active]);
  const id = rows[0].id;
  created.push(id);
  const claims: UserClaims = { id, role, userName: name };
  const token = await TokenService.generateAccessToken(claims);
  if (stale) await pool.query("UPDATE users SET role=2 WHERE id=$1", [id]);
  return { id, token };
}

function auth(token: string, requestId = randomUUID()): HeadersInit {
  return { Authorization: `Bearer ${token}`, "X-Request-ID": requestId };
}

async function eventFor(requestId: string) {
  for (let i = 0; i < 50; i++) {
    const { rows } = await pool.query<{ id: string; count: number; status: number; error_code: string; stack: string | null;
      request_id: string; context: { route?: string; breadcrumbs?: Array<{ requestId?: string; requestBytes?: number }> };
      last_context: { route?: string; breadcrumbs?: Array<{ requestId?: string; requestBytes?: number }> } }>(
      "SELECT id,count,status,error_code,stack,request_id,context,last_context FROM diagnostic_groups WHERE request_id=$1", [requestId]);
    if (rows[0]) return rows[0];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("Не записано диагностическое событие HTTP");
}

async function run(): Promise<void> {
  const teacher = await fixture(2);
  const rop = await fixture(3);
  const admin = await fixture(1);
  const inactive = await fixture(2, false);
  const stale = await fixture(1, true, true);
  const image = readFileSync(new URL("../../../rpd-client-ts/public/docs/media/complect-table.png", import.meta.url));
  assert.ok(image.length > 100 * 1024 && image.length <= 2 * 1024 * 1024);
  const clientReportId = randomUUID();
  const linkedRequestId = randomUUID();
  const payload = { clientReportId, goal: "Открыть комплект", actual: "Не получилось сохранить",
    blocking: true, context: { route: "/complects/1?private=value", section: "Нагрузка",
      unknownSecret: "never-store-me", breadcrumbs: [{ at: new Date().toISOString(), kind: "http",
        route: "/api/complects/1?secret=value", requestId: linkedRequestId, status: 500 }] } };
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  form.set("screenshot", new Blob([image], { type: "image/png" }), "capture.png");
  const response = await fetch(`${api}/api/feedback`, { method: "POST", headers: auth(teacher.token), body: form });
  assert.equal(response.status, 201);
  const receipt = await response.json() as Receipt;
  reportId = receipt.id;
  assert.match(receipt.id, /^[0-9a-f-]{36}$/);
  assert.match(receipt.code, /^RPD-\d+$/);
  assert.equal(receipt.warning, undefined);

  const { rows } = await pool.query<{ actor_id: number; goal: string; actual: string; blocking: boolean;
    screenshot: Buffer; screenshot_size: number; screenshot_mime: string; request_id: string; context: unknown }>(
    "SELECT actor_id,goal,actual,blocking,screenshot,screenshot_size,screenshot_mime,request_id,context FROM feedback_reports WHERE id=$1",
    [receipt.id]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor_id, teacher.id);
  assert.equal(rows[0].goal, payload.goal);
  assert.equal(rows[0].actual, payload.actual);
  assert.equal(rows[0].blocking, true);
  assert.equal(rows[0].screenshot_size, image.length);
  assert.equal(rows[0].screenshot_mime, "image/png");
  assert.equal(createHash("sha256").update(rows[0].screenshot).digest("hex"),
    createHash("sha256").update(image).digest("hex"));
  assert.equal(rows[0].request_id, linkedRequestId);
  assert.equal(JSON.stringify(rows[0].context).includes("never-store-me"), false);
  assert.equal(JSON.stringify(rows[0].context).includes("private=value"), false);
  const { rows: outbox } = await pool.query<{ state: string }>(
    "SELECT state FROM feedback_outbox WHERE report_id=$1", [receipt.id]);
  assert.deepEqual(outbox, [{ state: "pending" }]);

  const retry = new FormData();
  retry.set("payload", JSON.stringify({ ...payload, goal: "Изменённый текст", actual: "Изменено" }));
  const repeated = await fetch(`${api}/api/feedback`, { method: "POST", headers: auth(teacher.token), body: retry });
  assert.equal(repeated.status, 201);
  assert.deepEqual(await repeated.json(), receipt);
  const { rows: same } = await pool.query<{ goal: string; n: number }>(
    "SELECT goal,(SELECT count(*)::int FROM feedback_outbox WHERE report_id=$1) AS n FROM feedback_reports WHERE id=$1", [receipt.id]);
  assert.deepEqual(same, [{ goal: payload.goal, n: 1 }]);

  for (const token of [teacher.token, rop.token, inactive.token, stale.token]) {
    for (const path of [`/api/feedback/${receipt.id}`, `/api/feedback/${receipt.id}/screenshot`, "/api/feedback/delivery-status"]) {
      const denied = await fetch(`${api}${path}`, { headers: auth(token) });
      assert.equal(denied.status, 403, path);
    }
  }
  const anonymous = await fetch(`${api}/api/feedback/${receipt.id}`);
  assert.equal(anonymous.status, 401);
  const detail = await fetch(`${api}/api/feedback/${receipt.id}`, { headers: auth(admin.token) });
  assert.equal(detail.status, 200);
  const metadata = await detail.json() as { id: string; code: string; goal: string; screenshotSize: number; context: unknown };
  assert.equal(metadata.id, receipt.id);
  assert.equal(metadata.code, receipt.code);
  assert.equal(metadata.goal, payload.goal);
  assert.equal(metadata.screenshotSize, image.length);
  assert.equal(JSON.stringify(metadata).includes("never-store-me"), false);
  const screenshot = await fetch(`${api}/api/feedback/${receipt.id}/screenshot`, { headers: auth(admin.token) });
  assert.equal(screenshot.status, 200);
  assert.equal(screenshot.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await screenshot.arrayBuffer()), image);
  const delivery = await fetch(`${api}/api/feedback/delivery-status`, { headers: auth(admin.token) });
  assert.equal(delivery.status, 200);
  assert.equal((await delivery.json() as { deliveryEnabled: boolean }).deliveryEnabled, false);

  for (const token of [inactive.token, stale.token]) {
    const blocked = new FormData();
    blocked.set("payload", JSON.stringify({ ...payload, clientReportId: randomUUID() }));
    blocked.set("screenshot", new Blob([image], { type: "image/png" }), "capture.png");
    const denied = await fetch(`${api}/api/feedback`, { method: "POST", headers: auth(token), body: blocked });
    assert.equal(denied.status, 403);
  }
  const { rows: actorReports } = await pool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM feedback_reports WHERE actor_id=ANY($1::int[])", [[inactive.id, stale.id]]);
  assert.equal(actorReports[0].n, 0);

  const clientEventId = randomUUID();
  const diagnostic = { clientEventId, operation: "complect.sync", errorCode: "HTTP_500", status: 500,
    context: { route: "/api/complects/1?private=value", clientRelease: nonce } };
  const firstEvent = await fetch(`${api}/api/diagnostics/events`, { method: "POST",
    headers: { ...auth(teacher.token), "Content-Type": "application/json" }, body: JSON.stringify(diagnostic) });
  assert.equal(firstEvent.status, 201);
  const eventReceipt = await firstEvent.json() as { id: string; code: string; count: number };
  assert.equal(eventReceipt.count, 1);
  const duplicateEvent = await fetch(`${api}/api/diagnostics/events`, { method: "POST",
    headers: { ...auth(teacher.token), "Content-Type": "application/json" }, body: JSON.stringify(diagnostic) });
  assert.equal(duplicateEvent.status, 201);
  assert.deepEqual(await duplicateEvent.json(), eventReceipt);
  const { rows: eventState } = await pool.query<{ count: number; n: number }>(
    "SELECT g.count,(SELECT count(*)::int FROM feedback_outbox WHERE group_id=g.id) AS n FROM diagnostic_groups g WHERE g.id=$1",
    [eventReceipt.id]);
  assert.deepEqual(eventState, [{ count: 1, n: 1 }]);

  const tooLargeRequestId = randomUUID();
  const oversized = JSON.stringify({ marker: "body-must-not-be-stored", data: "x".repeat(1_100_000) });
  const large = await fetch(`${api}/api/complects/sync/apply?secret=value`, { method: "POST",
    headers: { ...auth(teacher.token, tooLargeRequestId), "Content-Type": "application/json" }, body: oversized });
  assert.equal(large.status, 413);
  assert.equal(large.headers.get("X-Request-ID"), tooLargeRequestId);
  const event = await eventFor(tooLargeRequestId);
  if (event.count === 1 && event.request_id === tooLargeRequestId)
    ownHttp413Group = { id: event.id, requestId: tooLargeRequestId };
  assert.equal(event.status, 413);
  assert.equal(event.request_id, tooLargeRequestId);
  assert.equal(event.last_context.route, "/api/complects/sync/apply");
  assert.equal(event.last_context.breadcrumbs?.[0].requestId, tooLargeRequestId);
  assert.equal(event.last_context.breadcrumbs?.[0].requestBytes, Buffer.byteLength(oversized));
  for (const sample of [event.context, event.last_context]) {
    assert.equal(JSON.stringify(sample).includes("body-must-not-be-stored"), false);
    assert.equal(JSON.stringify(sample).includes("secret=value"), false);
  }

  const previousFeedbackFlag = process.env.FEEDBACK_ENABLED;
  delete process.env.FEEDBACK_ENABLED;
  const disabledApp = express();
  disabledApp.use("/api", feedbackRouter);
  const disabledServer = await new Promise<ReturnType<typeof disabledApp.listen>>((resolve) => {
    const listener = disabledApp.listen(0, "127.0.0.1", () => resolve(listener));
  });
  try {
    const address = disabledServer.address();
    assert.ok(address && typeof address !== "string");
    const local = `http://127.0.0.1:${address.port}`;
    const config = await fetch(`${local}/api/feedback/config`, { headers: auth(teacher.token) });
    assert.equal(config.status, 200);
    assert.deepEqual(await config.json(), { enabled: false });
    const unavailable = await fetch(`${local}/api/feedback`, { method: "POST" });
    assert.equal(unavailable.status, 503);
  } finally {
    await new Promise<void>((resolve, reject) => disabledServer.close((error) => error ? reject(error) : resolve()));
  }

  process.env.FEEDBACK_ENABLED = "true";
  function firstCause(): Error { const failure = new Error("first secret message"); failure.name = "SyntheticFailure"; return failure; }
  function secondCause(): Error { const failure = new Error("second secret message"); failure.name = "SyntheticFailure"; return failure; }
  function sqlCause(code: string): Error {
    const failure = new Error("synthetic private SQL detail");
    failure.name = "DatabaseError";
    return Object.assign(failure, { code });
  }
  const isolated = express();
  isolated.use(feedbackDiagnostics(nonce));
  isolated.get("/api/fixture-failure", (req, res) => {
    markFeedbackFailure(res, req.get("X-Fixture-Cause") === "first" ? firstCause() : secondCause());
    res.status(500).end();
  });
  isolated.get("/api/fixture-sql-failure", (req, res) => {
    const failure = sqlCause(req.get("X-Fixture-Sqlstate") ?? "23505");
    if (req.get("X-Fixture-Mark") === "central") markFeedbackFailure(res, failure);
    ErrorUtils.catchError(res, failure);
  });
  const server = await new Promise<ReturnType<typeof isolated.listen>>((resolve) => {
    const listener = isolated.listen(0, "127.0.0.1", () => resolve(listener));
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const localUrl = `http://127.0.0.1:${address.port}/api/fixture-failure?secret=value`;
    const ids: string[] = [];
    for (const cause of ["first", "second"]) {
      const requestId = randomUUID();
      const failed = await fetch(localUrl, { headers: { "X-Request-ID": requestId, "X-Fixture-Cause": cause } });
      assert.equal(failed.status, 500);
      const saved = await eventFor(requestId);
      assert.equal(saved.error_code, "SyntheticFailure");
      assert.equal(saved.context.route, "/api/fixture-failure");
      assert.equal(JSON.stringify(saved).includes("secret message"), false);
      ids.push(saved.id);
    }
    assert.notEqual(ids[0], ids[1], "Разные места сбоя сохраняются разными группами");

    const sqlUrl = `http://127.0.0.1:${address.port}/api/fixture-sql-failure?secret=value`;
    const sqlGroups = new Map<string, string>();
    for (const code of ["23505", "23514"]) {
      const requestId = randomUUID();
      const failed = await fetch(sqlUrl, { headers: { "X-Request-ID": requestId, "X-Fixture-Sqlstate": code,
        "X-Fixture-Mark": code === "23505" ? "central" : "direct" } });
      assert.equal(failed.status, 500);
      const saved = await eventFor(requestId);
      assert.equal(saved.error_code, `DatabaseError:${code}`);
      assert.equal(saved.context.route, "/api/fixture-sql-failure");
      assert.equal(JSON.stringify(saved).includes("synthetic private SQL detail"), false);
      sqlGroups.set(code, saved.id);
    }
    assert.notEqual(sqlGroups.get("23505"), sqlGroups.get("23514"), "Разные SQLSTATE не объединяются");
    const repeated = await fetch(sqlUrl, { headers: { "X-Request-ID": randomUUID(), "X-Fixture-Sqlstate": "23505" } });
    assert.equal(repeated.status, 500);
    let sameCodeCount = 0;
    for (let attempt = 0; attempt < 50; attempt++) {
      const { rows } = await pool.query<{ count: number }>("SELECT count FROM diagnostic_groups WHERE id=$1", [sqlGroups.get("23505")]);
      sameCodeCount = rows[0]?.count ?? 0;
      if (sameCodeCount === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(sameCodeCount, 2, "Повтор одного SQLSTATE увеличивает счётчик своей группы");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousFeedbackFlag === undefined) delete process.env.FEEDBACK_ENABLED;
    else process.env.FEEDBACK_ENABLED = previousFeedbackFlag;
  }
}

try { await run(); process.stdout.write("feedback HTTP/PG proof passed\n"); }
finally {
  if (reportId) await pool.query("DELETE FROM feedback_reports WHERE id=$1", [reportId]);
  if (ownHttp413Group) await pool.query(
    "DELETE FROM diagnostic_groups WHERE id=$1 AND count=1 AND request_id=$2",
    [ownHttp413Group.id, ownHttp413Group.requestId]);
  await pool.query("DELETE FROM diagnostic_groups WHERE client_release=$1", [nonce]);
  // Fixture users stay until the synthetic DB is torn down: other parallel E2E tests snapshot users.
  await pool.end();
}
