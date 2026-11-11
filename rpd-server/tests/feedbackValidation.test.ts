import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import feedbackRouter from "../app/routes/feedback.ts";
import { cleanStack, diagnosticFingerprint, parseDiagnostic, parseManual, pathOnly, sanitizeContext, screenshotMime } from "../app/modules/feedbackValidation.ts";

const id = "4d091b12-8797-41ec-b5a2-605815cb67f3";

test("контекст оставляет только разрешённые поля и пути без query/fragment", () => {
  const result = sanitizeContext({
    clientRelease: "2.4.2", route: "/editor/12?token=private#part", teacherName: "Петров",
    editorContent: "секрет", cookies: "secret", auth: "Bearer secret",
    breadcrumbs: [{ at: "2026-11-11T10:00:00Z", kind: "http", method: "POST", route: "/api/save/12?secret=1",
      requestId: id, body: "secret", headers: { Authorization: "secret" } }],
  });
  assert.equal(result.route, "/editor/12");
  assert.equal(result.breadcrumbs?.[0]?.route, "/api/save/12");
  const serialized = JSON.stringify(result);
  for (const secret of ["teacherName", "Петров", "editorContent", "секрет", "cookies", "Bearer", "secret=1"]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(pathOnly("https://example.test/?token=1"), undefined);
});

test("заявка сохраняет авторский текст и связывает последний requestId", () => {
  const result = parseManual({ clientReportId: id, goal: "  Загрузить РПД.  ", actual: "Ошибка.\n", blocking: true,
    context: { route: "/editor", breadcrumbs: [{ at: "2026-11-11T10:00:00Z", kind: "http", requestId: id }] } });
  assert.equal(result.goal, "  Загрузить РПД.  ");
  assert.equal(result.actual, "Ошибка.\n");
  assert.equal(result.requestId, id);
});

test("диагностика отсекает ожидаемые ошибки, а группировка нормализует ID маршрута", () => {
  const first = parseDiagnostic({ clientEventId: id, operation: "save.template", errorCode: "HTTP_500", status: 500,
    stack: "Error: private message\n at saveTemplate (https://example.test/secret.js?token=1:12:3)",
    context: { clientRelease: "2.4.2", route: "/api/templates/123?secret=1" } });
  const second = parseDiagnostic({ clientEventId: "77a78ceb-d783-40fe-9676-5a4f1344b9e6", operation: "save.template", errorCode: "HTTP_500", status: 500,
    stack: "Error: another private message\n at saveTemplate (/different/private.js:15:9)",
    context: { clientRelease: "2.4.2", route: "/api/templates/456" } });
  assert.equal(first.stack, "saveTemplate");
  assert.equal(cleanStack("Error: secret"), undefined);
  assert.equal(diagnosticFingerprint(first), diagnosticFingerprint(second));
  assert.throws(() => parseDiagnostic({ ...first, status: 404 }), { status: 422, error: "Ожидаемые ошибки не регистрируются" });
  assert.throws(() => parseDiagnostic({ ...first, errorCode: "SessionChangedError" }), { status: 422, error: "Ожидаемые действия не регистрируются" });
  assert.throws(() => parseDiagnostic({ ...first, context: { route: "/api/feedback" } }), { status: 422, error: "Ожидаемые действия не регистрируются" });
});

test("сигнатура изображения проверяется по байтам", () => {
  const png = Buffer.alloc(45);
  Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]).copy(png);
  png.writeUInt32BE(1, 16);
  png.writeUInt32BE(1, 20);
  Buffer.from("IEND").copy(png, 37);
  assert.equal(screenshotMime(png), "image/png");
  const jpeg = Buffer.alloc(20);
  jpeg[0] = 255; jpeg[1] = 216; jpeg[2] = 255; jpeg[18] = 255; jpeg[19] = 217;
  assert.equal(screenshotMime(jpeg), "image/jpeg");
  assert.equal(screenshotMime(Buffer.from("not an image")), undefined);
});

function request(app: express.Express, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = "GET";
    req.url = path;
    const res = new ServerResponse(req);
    res.end = (() => { resolve(res.statusCode); return res; }) as typeof res.end;
    app(req, res);
    req.push(null);
    req.on("error", reject);
  });
}

test("feature flag закрывает только новые маршруты; включённый маршрут требует JWT", async (t) => {
  const previous = process.env.FEEDBACK_ENABLED;
  t.after(() => { if (previous === undefined) delete process.env.FEEDBACK_ENABLED; else process.env.FEEDBACK_ENABLED = previous; });
  const app = express();
  app.use("/api", feedbackRouter);
  app.get("/api/health", (_req, res) => { res.status(200).end(); });
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    res.status(error.status ?? 500).end();
  });
  process.env.FEEDBACK_ENABLED = "false";
  assert.equal(await request(app, "/api/feedback/delivery-status"), 503);
  assert.equal(await request(app, "/api/health"), 200);
  process.env.FEEDBACK_ENABLED = "true";
  assert.equal(await request(app, "/api/feedback/delivery-status"), 401);
});
