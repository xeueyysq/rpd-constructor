import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "@playwright/test";

test("обращение и очередь проходят через HTTP и PostgreSQL", async () => {
  for (const [name, script, args] of [
    ["HTTP API и группировка ошибок", "tests/integration/feedbackHttp.ts", []],
    ["Аренда, пауза и хранение outbox", "tests/integration/feedbackPersistence.test.ts", ["--test"]],
  ] as const) {
    await test.step(name, () => {
      const result = spawnSync("node", ["--env-file=../e2e/e2e.env", ...args, script], {
        cwd: new URL("../../../rpd-server/", import.meta.url), encoding: "utf8", timeout: 30_000,
      });
      if (result.error) throw new Error(`${name}: ${result.error.message}\n${result.stdout}\n${result.stderr}`);
      assert.equal(result.status, 0, `${name} завершился с кодом ${result.status} (${result.signal})\n${result.stdout}\n${result.stderr}`);
    });
  }
});
