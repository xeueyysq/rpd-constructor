import test from "node:test";
import assert from "node:assert/strict";
import express, { type ErrorRequestHandler } from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import jwt from "jsonwebtoken";
import axios from "axios";
import router from "../app/routes/routes.ts";
import { pool } from "../config/db.ts";
import { admin, rop, teacher, templateDatabase } from "./helpers/templateImportDatabase.ts";

const secret = "packet2-local-test-secret";

// Настоящие router, JWT middleware, express.json и query parser. Запрос проходит
// через HTTP IncomingMessage/ServerResponse без сетевого listener.
function request(app: express.Express, method: string, url: string, actor?: typeof rop, body?: unknown): Promise<{ status: number; body: Record<string, unknown> | unknown[] }> {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = url;
    if (actor) req.headers.authorization = `Bearer ${jwt.sign(actor, secret)}`;
    const data = body === undefined ? undefined : JSON.stringify(body);
    if (data !== undefined) {
      req.headers["content-type"] = "application/json";
      req.headers["content-length"] = String(Buffer.byteLength(data));
    }
    const res = new ServerResponse(req);
    res.end = ((chunk?: unknown) => {
      try { resolve({ status: res.statusCode, body: chunk ? JSON.parse(String(chunk)) : {} }); }
      catch (error) { reject(error); }
      return res;
    }) as typeof res.end;
    app(req, res);
    if (data !== undefined) req.push(data);
    req.push(null);
  });
}

test("реальные маршруты: JWT, manager-only, ids[] preview чужого draft, full/field copy, Apply и clear", async (t) => {
  const oldSecret = process.env.ACCESS_TOKEN_SECRET;
  process.env.ACCESS_TOKEN_SECRET = secret;
  t.after(() => { if (oldSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = oldSecret; });
  const db = templateDatabase();
  t.mock.method(pool, "query", db.db.query.bind(db.db));
  t.mock.method(pool, "connect", db.db.connect.bind(db.db));
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(((error, _req, res, next) => { void next; res.status(error.status ?? 500).json({ error: error.error ?? String(error) }); }) as ErrorRequestHandler);

  assert.equal((await request(app, "GET", "/api/template-import/sources?targetTemplateId=20")).status, 401);
  assert.equal((await request(app, "GET", "/api/template-import/sources", teacher)).status, 422);
  const catalog = await request(app, "GET", "/api/template-import/sources?targetTemplateId=20", teacher);
  assert.equal(catalog.status, 200);
  assert.equal((await request(app, "GET", "/api/get-changeable-values?ids%5B%5D=10&rowName=goals&targetTemplateId=20", teacher)).status, 200);
  assert.deepEqual((await request(app, "GET", "/api/get-changeable-values?ids%5B%5D=10&rowName=goals", teacher)).body, []);
  // Обычный source read не получил импортное разрешение.
  assert.equal((await request(app, "POST", "/api/rpd-profile-templates", teacher, { id: 10 })).status, 403);
  assert.equal((await request(app, "POST", "/api/copy-template-data", teacher, { sourceTemplateId: 10, targetTemplateId: 20, fieldToCopy: "goals", baseAt: null })).status, 200);
  assert.equal((await request(app, "POST", "/api/copy-template-data", teacher, { sourceTemplateId: 10, targetTemplateId: 20, fieldToCopy: "competencies", baseAt: null })).status, 422);
  assert.equal((await request(app, "POST", "/api/copy-template-content", teacher, { sourceTemplateId: 10, targetTemplateId: 20, targetRevision: (catalog.body as Record<string, unknown>).targetRevision })).status, 409);
  for (const [method, path, body] of [
    ["PUT", "/api/templates/20/participants", { teacherIds: [8, 9], baseTeacherIds: [8] }],
    ["POST", "/api/templates/20/content-control/clear", { rowId: "first", baseAt: null }],
    ["POST", "/api/template-import/complect", { sourceComplectId: 1, targetComplectId: 2, targetRevision: "baseline" }],
  ] as const) assert.equal((await request(app, method, path, teacher, body)).status, 403, path);
  const applied = await request(app, "PUT", "/api/templates/20/participants", rop, { teacherIds: [8, 9], baseTeacherIds: [8] });
  assert.equal(applied.status, 200);
  assert.equal((await request(app, "PUT", "/api/templates/20/participants", rop, { teacherIds: [8], baseTeacherIds: [8] })).status, 409);
  const cleared = await request(app, "POST", "/api/templates/20/content-control/clear", rop, { rowId: "first", baseAt: null });
  assert.equal(cleared.status, 200);
  assert.equal((cleared.body as Record<string, unknown>).field, "content");
  const bulkCatalog = await request(app, "GET", "/api/template-import/sources?targetComplectId=2", rop);
  assert.equal((await request(app, "POST", "/api/template-import/complect", rop, { sourceComplectId: 1, targetComplectId: 2, targetRevision: (bulkCatalog.body as Record<string, unknown>).targetRevision })).status, 200);
});

test("create: реальные router/JWT проверяют текущие роли и полный ключ до внешнего 1С и записи", async (t) => {
  const oldSecret = process.env.ACCESS_TOKEN_SECRET;
  process.env.ACCESS_TOKEN_SECRET = secret;
  t.after(() => { if (oldSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = oldSecret; });
  const db = templateDatabase();
  let writes = 0;
  t.mock.method(pool, "query", db.db.query.bind(db.db));
  // Любой вход в записывающую транзакцию и внешний HTTP — отрицательные контроли.
  t.mock.method(pool, "connect", async () => { writes++; throw new Error("Запись запрещённого create"); });
  const upstream = t.mock.method(axios, "post", async () => ({ data: [] }));
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(((error, _req, res, next) => { void next; res.status(error.status ?? 500).json({ error: error.error }); }) as ErrorRequestHandler);
  const before = structuredClone(db.state);
  const path = "/api/create_rpd_complect";
  const body = { data: { faculty: "Синтетический институт", year: "2026", formEducation: "Очная",
    levelEducation: "Бакалавриат", profile: "Синтетический профиль", directionOfStudy: "09.03.01" } };
  assert.equal((await request(app, "POST", path, undefined, body)).status, 401);
  assert.equal((await request(app, "POST", path, teacher, body)).status, 403);
  for (const actor of [rop, admin]) {
    const current = db.state.users.find((user) => user.id === actor.id)!;
    for (const role of [teacher.role, actor.role === rop.role ? admin.role : rop.role]) {
      current.role = role;
      assert.equal((await request(app, "POST", path, actor, body)).status, 403);
    }
    current.role = actor.role;
    current.is_active = false;
    assert.equal((await request(app, "POST", path, actor, body)).status, 403);
    current.is_active = true;
  }
  // Полный ключ обязателен до внешнего запроса и транзакции, в том числе для ADMIN.
  const invalid: unknown[] = [undefined, null, [], {}, "invalid"];
  for (const key of ["faculty", "formEducation", "levelEducation", "profile", "directionOfStudy", "year"]) {
    for (const value of [undefined, null, "", " "]) invalid.push({ ...body.data, [key]: value });
  }
  for (const year of [0, -1, 2026.5, "2026.5", "abc", "0x7ea", true, {}, 2147483648]) invalid.push({ ...body.data, year });
  for (const data of invalid) {
    assert.equal((await request(app, "POST", path, admin, { data })).status, 422);
  }
  assert.equal(upstream.mock.callCount(), 0);
  assert.equal(writes, 0);
  assert.deepEqual(db.state, before);
});
