import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrations, runMigrations, type Migration, type MigrationClient } from "../app/migrations/runner.ts";
import { nextMigrationFilename } from "../app/migrations/new.ts";

type Call = { sql: string; params?: unknown[] };

function fakeClient(initial: Array<{ name: string; checksum: string }> = []) {
  const calls: Call[] = [];
  const applied = [...initial];
  let pending: { name: string; checksum: string } | undefined;
  const client = {
    async query(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      if (sql.includes("FROM schema_migrations")) return { rows: [...applied] };
      if (sql === "BEGIN") pending = undefined;
      if (sql.startsWith("INSERT INTO schema_migrations")) pending = { name: String(params?.[0]), checksum: String(params?.[1]) };
      if (sql === "COMMIT" && pending) applied.push(pending);
      if (sql === "ROLLBACK") pending = undefined;
      return { rows: [] };
    },
  } as unknown as MigrationClient;
  return { client, calls, applied };
}

const quiet = { log: () => {}, warn: () => {} };
const migration = (name: string, up: Migration["up"] = async () => {}): Migration => ({ name, checksum: `${name}-hash`, up });
const sql = (calls: Call[]) => calls.map((call) => call.sql);

test("ожидающие миграции применяются по порядку с журналом в отдельных транзакциях и общей блокировкой", async () => {
  const fake = fakeClient();
  const names = await runMigrations(fake.client, [migration("0001_first", async (client) => { await client.query("FIRST"); }), migration("0002_second", async (client) => { await client.query("SECOND"); })], quiet);
  assert.deepEqual(names, ["0001_first", "0002_second"]);
  assert.match(fake.calls[0].sql, /^SELECT pg_advisory_lock\(hashtext\('rpd_schema_migrations'\)\)/);
  assert.match(fake.calls[1].sql, /^CREATE TABLE IF NOT EXISTS schema_migrations/);
  assert.deepEqual(sql(fake.calls).slice(3, -1).map((value) => value.startsWith("INSERT INTO schema_migrations") ? "INSERT" : value), ["BEGIN", "FIRST", "INSERT", "COMMIT", "BEGIN", "SECOND", "INSERT", "COMMIT"]);
  assert.match(fake.calls.at(-1)?.sql ?? "", /^SELECT pg_advisory_unlock\(hashtext\('rpd_schema_migrations'\)\)/);
  assert.deepEqual(fake.calls.filter((call) => call.sql.startsWith("INSERT INTO schema_migrations")).map((call) => call.params), [["0001_first", "0001_first-hash"], ["0002_second", "0002_second-hash"]]);
});

test("применённые миграции пропускаются и повторный запуск пуст", async () => {
  const fake = fakeClient();
  const migrations = [migration("0001_first")];
  assert.deepEqual(await runMigrations(fake.client, migrations, quiet), ["0001_first"]);
  const start = fake.calls.length;
  assert.deepEqual(await runMigrations(fake.client, migrations, quiet), []);
  assert.equal(sql(fake.calls.slice(start)).includes("BEGIN"), false);
});

test("ошибка в up откатывает текущую миграцию, останавливает следующие и освобождает блокировку", async () => {
  const fake = fakeClient();
  await assert.rejects(runMigrations(fake.client, [migration("0001_bad", async () => { throw new Error("сломано"); }), migration("0002_later", async (client) => { await client.query("LATER"); })], quiet), /Миграция 0001_bad не применена: сломано/);
  assert.deepEqual(sql(fake.calls).slice(3, -1), ["BEGIN", "ROLLBACK"]);
  assert.match(fake.calls.at(-1)?.sql ?? "", /pg_advisory_unlock/);
  assert.deepEqual(fake.applied, []);
});

test("отсутствие файла применённой миграции останавливает запуск до BEGIN", async () => {
  const fake = fakeClient([{ name: "0001_missing", checksum: "hash" }]);
  await assert.rejects(runMigrations(fake.client, [migration("0002_next")], quiet), /переименована или удалена/);
  assert.equal(sql(fake.calls).includes("BEGIN"), false);
  assert.match(fake.calls.at(-1)?.sql ?? "", /pg_advisory_unlock/);
});

test("миграция с номером ниже последней применённой отвергается до BEGIN", async () => {
  const fake = fakeClient([{ name: "0002_second", checksum: "0002_second-hash" }]);
  await assert.rejects(runMigrations(fake.client, [migration("0001_first"), migration("0002_second")], quiet), /следующий номер/);
  assert.equal(sql(fake.calls).includes("BEGIN"), false);
});

test("изменённый checksum вызывает предупреждение и не блокирует новые миграции", async () => {
  const fake = fakeClient([{ name: "0001_first", checksum: "old-hash" }]);
  const warnings: string[] = [];
  assert.deepEqual(await runMigrations(fake.client, [migration("0001_first"), migration("0002_second")], { log: quiet.log, warn: (message) => warnings.push(message) }), ["0002_second"]);
  assert.match(warnings[0], /0001_first/);
  assert.deepEqual(fake.applied.map((row) => row.name), ["0001_first", "0002_second"]);
});

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "rpd-migrations-"));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("loadMigrations сортирует файлы, вычисляет sha256 и игнорирует прочие расширения", async () => {
  await withTempDir(async (dir) => {
    const source = "export async function up() {}\n";
    await writeFile(join(dir, "0002_second.ts"), source);
    await writeFile(join(dir, "0001_first.ts"), source);
    await writeFile(join(dir, "notes.md"), "ignored");
    const migrations = await loadMigrations(dir);
    assert.deepEqual(migrations.map((item) => item.name), ["0001_first", "0002_second"]);
    assert.equal(migrations[0].checksum, createHash("sha256").update(source).digest("hex"));
    assert.equal(typeof migrations[0].up, "function");
  });
});

test("loadMigrations отвергает дубли номеров", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "0001_first.ts"), "export async function up() {}\n");
    await writeFile(join(dir, "0001_other.ts"), "export async function up() {}\n");
    await assert.rejects(loadMigrations(dir), /0001/);
  });
});

test("loadMigrations отвергает неверное имя .ts и модуль без up", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "bad-name.ts"), "export async function up() {}\n");
    await assert.rejects(loadMigrations(dir), /bad-name\.ts/);
    await rm(join(dir, "bad-name.ts"));
    await writeFile(join(dir, "0001_empty.ts"), "export const value = 1;\n");
    await assert.rejects(loadMigrations(dir), /0001_empty\.ts/);
  });
});

test("имя следующей миграции использует максимальный номер и проверяет slug", () => {
  assert.equal(nextMigrationFilename(["0003_last.ts", "0001_first.ts", "notes.md"], "add_book_isbn"), "0004_add_book_isbn.ts");
  assert.throws(() => nextMigrationFilename(["0001_first.ts"], "Bad-Name"), /Bad-Name/);
});

test("настоящий каталог содержит загружаемую базовую миграцию", async () => {
  const dir = fileURLToPath(new URL("../app/migrations/versions/", import.meta.url));
  const files = await readdir(dir);
  assert.ok(files.includes("0001_baseline.ts"));
  const migrations = await loadMigrations(dir);
  assert.equal(migrations[0].name, "0001_baseline");
  assert.equal(typeof migrations[0].up, "function");
});
