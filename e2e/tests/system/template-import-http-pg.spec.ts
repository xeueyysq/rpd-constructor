import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from '@playwright/test';

test('импорт проходит настоящий HTTP router и синтетическую PostgreSQL', async () => {
  for (const [name, file] of [
    ['HTTP + PostgreSQL', 'tests/templateImportHttpPg.test.ts'],
    ['DOCX генератора', 'tests/wordImport.test.ts'],
  ] as const) {
    await test.step(name, () => {
      const result = spawnSync('node', ['--env-file=../e2e/e2e.env', '--test', file], {
        cwd: new URL('../../../rpd-server/', import.meta.url), encoding: 'utf8', timeout: 90_000,
      });
      if (result.error) throw new Error(`${name}: ${result.error.message}\n${result.stdout}\n${result.stderr}`);
      assert.equal(result.status, 0, `${name}: ${result.status} (${result.signal})\n${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /# skipped 0\b/, `${name} не должен пропускаться`);
    });
  }
});
