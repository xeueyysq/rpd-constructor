import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import RpdProfileTemplates from "../app/models/rpd_profile_templates.ts";
import { USER_ROLES } from "../app/models/constants.ts";
import express from "express";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import type { Request, Response } from "express";
import RpdProfileTemplatesController from "../app/controllers/rpdProfileTemplatesController.ts";

test("реальный simple query parser Express: ids и ids[] в скалярной и массивной форме", async () => {
  const db = { query: async (sql: string, values: unknown[]) => {
    if (sql.includes("AS participant")) return { rows: [{ exists: true, owner: true, active: true }] };
    if (sql.includes("AS active")) return { rows: [{ active: true }] };
    if (sql.includes("SELECT id FROM")) return { rows: [{ id: Number(values[0]) }] };
    return { rows: (values[0] as number[]).map((id) => ({ id, public_id: `rpd-${id}`, goals: `Цель ${id}` })) };
  } } as unknown as Pool;
  const controller = new RpdProfileTemplatesController(db);
  const app = express();
  assert.equal(app.get("query parser"), "simple");
  for (const query of ["ids=1", "ids%5B%5D=1", "ids=1&ids=2", "ids%5B%5D=1&ids%5B%5D=2"]) {
    // IncomingMessage + express.request.query: настоящий HTTP query parser без listen.
    // Обработчик и SQL-I/O исполняются отдельно от сети.
    const req = new IncomingMessage(new Socket()) as Request;
    Object.setPrototypeOf(req, app.request);
    req.app = app;
    req.url = `/get-changeable-values?${query}&rowName=goals`;
    req.user = { id: 7, role: USER_ROLES.ROP, userName: "rop" };
    let response: unknown;
    await controller.getChangeableValues(req, { json: (value: unknown) => { response = value; } } as Response);
    assert.deepEqual(response, (query.includes("2") ? [1, 2] : [1]).map((id) => ({ id, public_id: `rpd-${id}`, goals: `Цель ${id}` })));
  }
});

test("get-changeable-values отвергает имя колонки вне whitelist до SQL", async () => {
  let queries = 0;
  const db = { query: async () => { queries++; return { rows: [] }; } } as unknown as Pool;
  const model = new RpdProfileTemplates(db);
  await assert.rejects(model.getChangeableValues([1], "content; DROP TABLE users", { id: 1, role: USER_ROLES.ADMIN, userName: "admin" }), { status: 422 });
  assert.equal(queries, 0);
});

test("get-changeable-values исключает недоступные шаблоны", async () => {
  let selectedIds: number[] = [];
  const db = { query: async (sql: string, params: unknown[]) => {
    if (sql.includes("AS active") && !sql.includes("AS participant")) return { rows: [{ active: true }] };
    if (sql.includes("SELECT id FROM rpd_profile_templates")) return { rows: [{ id: Number(params[0]) }] };
    if (sql.includes("AS participant")) return { rows: [{ exists: true, owner: Number(params[0]) === 1, participant: false, active: true }] };
    selectedIds = params[0] as number[];
    return { rows: [{ id: 1, content: {} }] };
  } } as unknown as Pool;
  const model = new RpdProfileTemplates(db);
  const rows = await model.getChangeableValues([1, 2], "content", { id: 7, role: USER_ROLES.ROP, userName: "rop" });
  assert.deepEqual(selectedIds, [1]);
  assert.deepEqual(rows, [{ id: 1, content: {} }]);
});
