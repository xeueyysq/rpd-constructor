import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { pool } from "../../config/db.ts";
import { loadMigrations, runMigrations } from "./runner.ts";

let client: PoolClient | undefined;
try {
  client = await pool.connect();
  const migrations = await loadMigrations(fileURLToPath(new URL("./versions/", import.meta.url)));
  const applied = await runMigrations(client, migrations);
  console.log(applied.length ? `Применено миграций: ${applied.length} (${applied.join(", ")})` : "Новых миграций нет");
} catch (error: unknown) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
