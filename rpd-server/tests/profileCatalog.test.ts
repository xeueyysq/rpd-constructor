import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import axios from "axios";
import express from "express";
import type { Pool } from "pg";
import SpecProfilesController from "../app/controllers/specProfilesController.ts";

const catalog = JSON.parse(readFileSync(new URL("../app/data/json_profiles.json", import.meta.url), "utf8")) as unknown;

test("GET /spec-profiles отдаёт локальный справочник без 1С и БД", async (t) => {
  const get1c = t.mock.method(axios, "get", async () => { throw new Error("Неожиданный запрос к 1С"); });
  let queries = 0;
  const database = {
    query: async () => {
      queries += 1;
      throw new Error("Неожиданный запрос к БД");
    },
  } as unknown as Pool;
  const controller = new SpecProfilesController(database);
  const app = express();
  app.get("/spec-profiles", controller.getProfiles.bind(controller));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(`http://127.0.0.1:${address.port}/spec-profiles`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { tree: catalog, source: "local" });
  assert.equal(get1c.mock.callCount(), 0);
  assert.equal(queries, 0);
});
