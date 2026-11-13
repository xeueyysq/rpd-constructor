import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { apiUrl, signIn } from '../helpers';
import { headersFor } from '../list3';

test('PDF и Word скачиваются с одинаковым русским именем и содержимым нужного формата', async ({ page, request }) => {
  const headers = await headersFor(request, 'admin');
  const basename = 'Лист согласования для теста_Тестовое направление_2025';
  await signIn(page, 'admin');
  await page.goto('/templates/a108a108a108/testPdf');
  await expect(page.getByRole('button', { name: 'Скачать PDF', exact: true })).toBeVisible();
  for (const [label, extension, signature] of [
    ['Скачать PDF', 'pdf', '%PDF-'], ['Скачать Word', 'docx', 'PK'],
  ] as const) {
    const response = await request.get(`${apiUrl}/api/generate-${extension}?id=108`, { headers });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain(`filename*=UTF-8''`);
    expect(decodeURIComponent(response.headers()['content-disposition'].split("filename*=UTF-8''")[1])).toBe(`${basename}.${extension}`);
    expect((await response.body()).subarray(0, signature.length).toString()).toBe(signature);
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByRole('button', { name: label, exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`${basename}.${extension}`);
    expect(await download.failure()).toBeNull();
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await readFile(path!)).subarray(0, signature.length).toString()).toBe(signature);
  }
});
