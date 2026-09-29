import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";

export type MigrationClient = Pick<PoolClient, "query">;
export type Migration = { name: string; checksum: string; up: (client: MigrationClient) => Promise<void> };

const filenamePattern = /^\d{4}_[a-z0-9]+(?:_[a-z0-9]+)*\.ts$/;
const lockSql = "SELECT pg_advisory_lock(hashtext('rpd_schema_migrations'))";
const unlockSql = "SELECT pg_advisory_unlock(hashtext('rpd_schema_migrations'))";

export async function loadMigrations(dir: string): Promise<Migration[]> {
  const files = (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".ts")).map((entry) => entry.name).sort();
  const numbers = new Set<string>();
  const migrations: Migration[] = [];
  for (const file of files) {
    if (!filenamePattern.test(file)) throw new Error(`Неверное имя файла миграции: ${file}`);
    const number = file.slice(0, 4);
    if (numbers.has(number)) throw new Error(`Дублируется номер миграции ${number}: ${file}`);
    numbers.add(number);
    const path = join(dir, file);
    const checksum = createHash("sha256").update(await readFile(path)).digest("hex");
    const module: unknown = await import(pathToFileURL(path).href);
    if (!module || typeof module !== "object" || !("up" in module) || typeof module.up !== "function") throw new Error(`В миграции ${file} нет экспортируемой функции up`);
    migrations.push({ name: file.slice(0, -3), checksum, up: module.up as Migration["up"] });
  }
  return migrations;
}

export async function runMigrations(client: MigrationClient, migrations: Migration[], log: Pick<Console, "log" | "warn"> = console): Promise<string[]> {
  await client.query(lockSql);
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const { rows } = await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM schema_migrations ORDER BY name");
    const files = new Map(migrations.map((migration) => [migration.name, migration]));
    const applied = new Set(rows.map((row) => row.name));
    const lastApplied = rows.at(-1)?.name;
    for (const row of rows) {
      const migration = files.get(row.name);
      if (!migration) throw new Error(`Применённая миграция ${row.name} переименована или удалена`);
    }
    for (const migration of migrations) {
      if (!applied.has(migration.name) && lastApplied && migration.name < lastApplied) throw new Error(`Миграция ${migration.name} добавлена после ${lastApplied}; используйте следующий номер`);
    }
    for (const row of rows) {
      if (files.get(row.name)?.checksum !== row.checksum) log.warn(`Контрольная сумма применённой миграции ${row.name} изменилась; применённые миграции не редактируют`);
    }

    const names: string[] = [];
    for (const migration of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
      if (applied.has(migration.name)) continue;
      try {
        await client.query("BEGIN");
        await migration.up(client);
        await client.query("INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)", [migration.name, migration.checksum]);
        await client.query("COMMIT");
      } catch (cause) {
        try { await client.query("ROLLBACK"); } catch { /* Исходная ошибка миграции важнее. */ }
        throw new Error(`Миграция ${migration.name} не применена: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
      }
      log.log(`Применена миграция ${migration.name}`);
      names.push(migration.name);
    }
    return names;
  } finally {
    try { await client.query(unlockSql); } catch (error) {
      log.warn(`Не удалось снять блокировку миграций: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
