import assert from "node:assert/strict";
import { test, mock } from "node:test";
import axios, { type AxiosRequestConfig } from "axios";
import { GoogleAuth } from "google-auth-library";
import { DeliveryError, FeedbackSheets, SHEET_HEADER, type SheetConfig } from "../app/services/feedbackSheets.ts";
import type { OutboxPayload } from "../app/services/Feedback.ts";

test("неопределённый ответ append сверяется по коду; сортировка и ручные E/F сохраняются", async () => {
  const config: SheetConfig = { enabled: true, ready: true, reason: null, spreadsheetId: "syntheticSpreadsheetId12345",
    sheetName: "Обращения", credentialsFile: "/synthetic/never-read.json", publicBaseUrl: "https://rpd.example.test" };
  const payload: OutboxPayload = { type: "diagnostic", id: "4d091b12-8797-41ec-b5a2-605815cb67f3",
    code: "RPD-314159", createdAt: new Date("2026-11-11T09:00:00Z"), lastSeen: new Date("2026-11-11T09:01:00Z"),
    operation: "complect.sync", errorCode: "HTTP_500", status: 500, count: 1, context: { clientRelease: "2.4.2" } };
  const rows: string[][] = [Array.from(SHEET_HEADER)];
  let appendCalls = 0;
  let updateCalls = 0;
  mock.method(GoogleAuth.prototype, "getAccessToken", async () => "synthetic-access-token");
  mock.method(axios, "request", async (request: AxiosRequestConfig) => {
    const range = decodeURIComponent(new URL(request.url!).pathname.split("/values/")[1]);
    if (request.method === "GET" && range.endsWith("A1:K1")) return { data: { values: [rows[0]] } };
    if (request.method === "GET" && range.endsWith("A1:A20001"))
      return { data: { values: rows.map((row) => [row[0]]) } };
    if (request.method === "POST" && range.endsWith("A1:K:append")) {
      appendCalls++;
      rows.push((request.data as { values: string[][] }).values[0]);
      throw new axios.AxiosError("synthetic lost append response", "ETIMEDOUT");
    }
    const match = range.match(/I(\d+):J\d+$/);
    if (request.method === "PUT" && match) {
      updateCalls++;
      const row = rows[Number(match[1]) - 1];
      assert.ok(row);
      [row[8], row[9]] = (request.data as { values: string[][] }).values[0];
      return { data: {} };
    }
    assert.fail(`Неожиданный запрос к фикстуре: ${request.method} ${range}`);
  });
  try {
    const sheets = new FeedbackSheets(config);
    await assert.rejects(sheets.sync(payload),
      (error: unknown) => error instanceof DeliveryError && error.code === "PROVIDER_NETWORK");
    assert.equal(appendCalls, 1);
    rows[1][4] = "Низкий";
    rows[1][5] = "В разборе";
    rows.splice(1, 0, ["RPD-12", "", "", "", "", "", "", "", "", "", ""]);
    await sheets.sync({ ...payload, count: 7, lastSeen: new Date("2026-11-11T10:00:00Z") });
    assert.equal(appendCalls, 1);
    assert.equal(updateCalls, 1);
    assert.equal(rows[2][0], payload.code);
    assert.equal(rows[2][4], "Низкий");
    assert.equal(rows[2][5], "В разборе");
    assert.equal(rows[2][8], "7");
    assert.equal(rows[2][9], "2026-11-11T10:00:00.000Z");

    rows.push([...rows[2]]);
    await assert.rejects(sheets.sync(payload),
      (error: unknown) => error instanceof DeliveryError && error.code === "DUPLICATE_CODE");
    assert.equal(appendCalls, 1);
    assert.equal(updateCalls, 1);
  } finally { mock.restoreAll(); }
});
