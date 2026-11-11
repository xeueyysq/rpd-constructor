import { test } from "node:test";
import assert from "node:assert/strict";
import { findCodeRow, sheetConfig, sheetRow, type DeliveryError } from "../app/services/feedbackSheets.ts";
import type { OutboxPayload } from "../app/services/Feedback.ts";

const base = "https://rpd.example.test";
const manual: OutboxPayload = {
  type: "manual", id: "4d091b12-8797-41ec-b5a2-605815cb67f3", code: "RPD-42",
  createdAt: new Date("2026-11-11T09:00:00.000Z"), goal: "Секретный текст заявки",
  blocking: true, context: { section: "Нагрузка", discipline: "Математика", complectId: 7, clientRelease: "2.4.2" },
};

test("строка Sheets передаёт служебную сводку без текста пользователя и точный URL диагностики", () => {
  const row = sheetRow(manual, base);
  assert.deepEqual(row, ["RPD-42", "2026-11-11T09:00:00.000Z", "Обращение", "обращение пользователя: нагрузка",
    "Высокий", "Новое", "№ 7 / Математика", "2.4.2", "1", "2026-11-11T09:00:00.000Z",
    "https://rpd.example.test/feedback/4d091b12-8797-41ec-b5a2-605815cb67f3"]);
  assert.equal(row.join(" ").includes(manual.goal), false);
});

test("диагностическая группа передаёт повторы и последний случай, не стек", () => {
  const row = sheetRow({ type: "diagnostic", id: manual.id, code: "RPD-43", createdAt: manual.createdAt,
    lastSeen: new Date("2026-11-11T10:05:00.000Z"), operation: "save.template", errorCode: "HTTP_500",
    status: 500, count: 9, context: { clientRelease: "2.4.2" } }, base);
  assert.equal(row[3], "ошибка · save template · http 500");
  assert.equal(row[4], "Высокий");
  assert.equal(row[8], "9");
  assert.equal(row[9], "2026-11-11T10:05:00.000Z");
  const serverRow = sheetRow({ type: "diagnostic", id: manual.id, code: "RPD-44", createdAt: manual.createdAt,
    lastSeen: manual.createdAt, operation: "http.post", errorCode: "TypeError", status: 500,
    count: 1, context: { route: "/api/complects/7" } }, base);
  assert.equal(serverRow[4], "Высокий");
});

test("поиск кода учитывает текущую сортировку и останавливается на дубликате", () => {
  const sorted = [["Код"], ["RPD-43"], ["RPD-42"]];
  assert.equal(findCodeRow(sorted, "RPD-42"), 3);
  assert.equal(findCodeRow(sorted, "RPD-99"), null);
  assert.throws(() => findCodeRow([...sorted, ["RPD-42"]], "RPD-42"),
    (error: unknown) => (error as DeliveryError).code === "DUPLICATE_CODE");
  assert.throws(() => findCodeRow([["Код"], ["чужая таблица"]], "RPD-42"),
    (error: unknown) => (error as DeliveryError).code === "SHEET_CODE_COLUMN_INVALID");
});

test("отсутствующий файл сервисного аккаунта отключает только доставку", (t) => {
  const previous = {
    enabled: process.env.FEEDBACK_GOOGLE_ENABLED, file: process.env.FEEDBACK_GOOGLE_CREDENTIALS_FILE,
    url: process.env.FEEDBACK_PUBLIC_BASE_URL,
  };
  t.after(() => {
    for (const [key, value] of [["FEEDBACK_GOOGLE_ENABLED", previous.enabled],
      ["FEEDBACK_GOOGLE_CREDENTIALS_FILE", previous.file], ["FEEDBACK_PUBLIC_BASE_URL", previous.url]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.FEEDBACK_GOOGLE_ENABLED = "true";
  process.env.FEEDBACK_GOOGLE_CREDENTIALS_FILE = "/private/tmp/rpd-feedback-key-does-not-exist.json";
  process.env.FEEDBACK_PUBLIC_BASE_URL = base;
  assert.deepEqual({ ready: sheetConfig().ready, reason: sheetConfig().reason },
    { ready: false, reason: "CREDENTIALS_FILE_MISSING" });
});
