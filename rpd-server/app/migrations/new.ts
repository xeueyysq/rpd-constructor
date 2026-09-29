import { readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const slugPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const filenamePattern = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.ts$/;
const versionsDir = fileURLToPath(new URL("./versions/", import.meta.url));

export function nextMigrationFilename(files: string[], slug: string): string {
  if (!slugPattern.test(slug)) throw new Error(`Неверное имя миграции: ${slug}`);
  const max = Math.max(0, ...files.map((file) => Number(filenamePattern.exec(file)?.[1] ?? 0)));
  if (max >= 9999) throw new Error("Номера миграций закончились");
  return `${String(max + 1).padStart(4, "0")}_${slug}.ts`;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("Укажите имя: bun run migrate:new <имя>");
  const filename = nextMigrationFilename(await readdir(versionsDir), slug);
  const path = join(versionsDir, filename);
  await writeFile(path, `import type { MigrationClient } from "../runner.ts";

// Что меняет миграция и зачем. Транзакцию открывает раннер: BEGIN/COMMIT здесь не пишите.
export async function up(client: MigrationClient): Promise<void> {
  await client.query(\`\`);
}
`, { flag: "wx" });
  console.log(path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
