import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("сервер запускается с DB_* из окружения", () => {
  const result = spawnSync(process.execPath, ["--env-file-if-exists=.env", "server.ts"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, DB_HOST: "127.0.0.1", DB_PORT: "1" },
    encoding: "utf8",
    timeout: 30000,
  });

  assert.equal(result.status, 0);
  assert.equal(result.signal, null);
  assert.match(result.stderr, /Ошибка подключения к PostgreSQL/);
  assert.match(result.stderr, /127\.0\.0\.1:1(?!\d)/);
  assert.doesNotMatch(result.stderr, /Missing parameter name/);
});
