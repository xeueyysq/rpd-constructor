import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import JSZip from "jszip";
import router from "../app/routes/routes.ts";
import { pool } from "../config/db.ts";
import { rop, teacher, templateDatabase } from "./helpers/templateImportDatabase.ts";
import { MAX_DOCX_BYTES } from "../app/modules/wordImport/inspectDocx.ts";

const secret = "packet2-local-test-secret";

test("HTTP Word: авторизация до файла, preview без записи, выбранные поля apply, stale и отзыв доступа", async (t) => {
  const oldSecret = process.env.ACCESS_TOKEN_SECRET;
  process.env.ACCESS_TOKEN_SECRET = secret;
  t.after(() => { if (oldSecret === undefined) delete process.env.ACCESS_TOKEN_SECRET; else process.env.ACCESS_TOKEN_SECRET = oldSecret; });
  const db = templateDatabase();
  t.mock.method(pool, "query", db.db.query.bind(db.db));
  t.mock.method(pool, "connect", db.db.connect.bind(db.db));
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(((error, _req, res, next) => { void next; res.status(error.status ?? 500).json({ error: error.error ?? "Ошибка" }); }) as ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const auth = { Authorization: `Bearer ${jwt.sign(teacher, secret)}` };
  const docx = readFileSync(new URL("./fixtures/avs-programma-ivt-trpo-2024.docx", import.meta.url));
  const form = (bytes: Uint8Array = docx) => { const data = new FormData(); data.set("file", new Blob([Uint8Array.from(bytes).buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), "rpd.docx"); return data; };
  const before = structuredClone(db.state);
  assert.equal((await fetch(`${url}/api/templates/20/import-word/preview`, { method: "POST", body: form() })).status, 401);
  assert.equal((await fetch(`${url}/api/templates/10/import-word/preview`, { method: "POST", headers: auth, body: form() })).status, 403);
  const response = await fetch(`${url}/api/templates/20/import-word/preview`, { method: "POST", headers: auth, body: form() });
  assert.equal(response.status, 200);
  const preview = await response.json() as { targetRevision: string; source: { discipline: string }; values: { goals: string; textbook: string[] }; availableFields: string[] };
  assert.equal(preview.source.discipline, "Архитектура вычислительных систем");
  assert.ok(preview.availableFields.includes("goals"));
  assert.deepEqual(db.state, before, "предпросмотр не пишет в БД");
  const zip = await JSZip.loadAsync(docx);
  for (let part = 0; part < 3; part++)
    zip.file(`word/reservation-check-${part}.xml`, `<root>${"x".repeat(7 * 1024 * 1024)}</root>`);
  const inspectedDocx = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const abort = new AbortController();
  const interrupted = fetch(`${url}/api/templates/20/import-word/preview`, {
    method: "POST", headers: auth, body: form(inspectedDocx), signal: abort.signal,
  }).catch(() => null);
  await new Promise<void>((resolve) => setTimeout(resolve, 40));
  assert.equal((await fetch(`${url}/api/templates/20/import-word/preview`, {
    method: "POST", headers: auth, body: form(),
  })).status, 429, "во время инспекции занят единственный слот");
  abort.abort();
  await interrupted;
  assert.equal((await fetch(`${url}/api/templates/20/import-word/preview`, {
    method: "POST", headers: auth, body: form(),
  })).status, 429, "закрытие HTTP не освобождает слот до конца инспекции");
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  assert.equal((await fetch(`${url}/api/templates/20/import-word/preview`, {
    method: "POST", headers: auth, body: form(),
  })).status, 200, "после завершения работы слот снова доступен");
  const body = { expectedRevision: preview.targetRevision, mode: "replace", selectedFields: ["goals", "textbook"],
    values: { goals: preview.values.goals, textbook: preview.values.textbook } };
  const apply = await fetch(`${url}/api/templates/20/import-word/apply`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(apply.status, 200);
  const result = await apply.json() as { updatedFields: string[]; targetRevision: string };
  assert.deepEqual(result.updatedFields, ["goals", "textbook"]);
  assert.notEqual(result.targetRevision, preview.targetRevision);
  assert.deepEqual(db.state.profiles[1].competencies, before.profiles[1].competencies);
  assert.equal(db.state.profiles[1].assessment_tools_template, before.profiles[1].assessment_tools_template);
  assert.equal(db.state.profiles[1].disciplins_name, before.profiles[1].disciplins_name);
  assert.equal((await fetch(`${url}/api/templates/20/import-word/apply`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 409);
  const protectedBody = { ...body, expectedRevision: result.targetRevision, selectedFields: ["competencies"], values: { competencies: {} } };
  assert.equal((await fetch(`${url}/api/templates/20/import-word/apply`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(protectedBody) })).status, 422);
  db.state.assignments = db.state.assignments.filter((assignment) => assignment.template_id !== 20);
  assert.equal((await fetch(`${url}/api/templates/20/import-word/apply`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, expectedRevision: result.targetRevision }) })).status, 403);
  const managerAuth = { Authorization: `Bearer ${jwt.sign(rop, secret)}` };
  assert.equal((await fetch(`${url}/api/templates/20/import-word/preview`, { method: "POST", headers: managerAuth, body: form(Buffer.alloc(MAX_DOCX_BYTES + 1)) })).status, 413);
  for (let i = 0; i < 5; i++) {
    assert.equal((await fetch(`${url}/api/templates/20/import-word/preview`, { method: "POST", headers: managerAuth, body: form(Buffer.from("bad")) })).status, 422);
  }
  assert.equal((await fetch(`${url}/api/templates/20/import-word/preview`, { method: "POST", headers: managerAuth, body: form() })).status, 429);
});
