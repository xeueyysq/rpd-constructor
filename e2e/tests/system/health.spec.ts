import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { apiUrl } from '../helpers.ts';

const packageData: unknown = JSON.parse(readFileSync(new URL('../../../rpd-server/package.json', import.meta.url), 'utf8'));
if (!packageData || typeof packageData !== 'object' || !('version' in packageData) || typeof packageData.version !== 'string') {
  throw new Error('Не найдена версия сервера в package.json');
}

test('health проверяет БД и сообщает версию сервера', async ({ request }) => {
  const response = await request.get(`${apiUrl}/api/health`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', version: packageData.version });
});
