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

test('преподаватель открывает документ назначенной РПД с титульного листа и скачивает PDF и Word', async ({ page, request }, testInfo) => {
  test.slow();
  const headers = await headersFor(request, 'teacher'); // teacher — userId 2, назначен на 108.
  const basename = 'Лист согласования для теста_Тестовое направление_2025';
  await page.setViewportSize({ width: 1365, height: 900 });
  await signIn(page, 'teacher');
  await page.goto('/templates/a108a108a108/coverPage');
  await expect(page.getByRole('main').getByText('Титульный лист', { exact: true })).toBeVisible();
  const entry = page.getByRole('navigation', { name: 'Разделы РПД' })
    .getByRole('button', { name: 'Сформировать документ', exact: true });
  await expect(entry).toBeVisible();
  await expect(entry).toBeInViewport({ ratio: 1 });
  const generated = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/generate-pdf'
    && new URL(response.url()).searchParams.get('id') === '108');
  await entry.click();
  await expect(page).toHaveURL(/\/templates\/a108a108a108\/testPdf$/);
  const pdf = await generated;
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const disposition = pdf.headers()['content-disposition'];
  expect(disposition).toContain("filename*=UTF-8''");
  expect(decodeURIComponent(disposition.split("filename*=UTF-8''")[1])).toBe(`${basename}.pdf`);
  for (const [label, extension, signature] of [
    ['Скачать PDF', 'pdf', '%PDF-'], ['Скачать Word', 'docx', 'PK'],
  ] as const) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeInViewport({ ratio: 1 });
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe(`${basename}.${extension}`);
    expect(await download.failure()).toBeNull();
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await readFile(path!)).subarray(0, signature.length).toString()).toBe(signature);
    // 301 — неизменяемый приватный источник teacher2, не назначается teacher другими тестами.
    const forbidden = await request.get(`${apiUrl}/api/generate-${extension}?id=301`, { headers });
    expect(forbidden.status()).toBe(403);
  }
  await expect(page.getByText(/^Страница 1 из \d+$/)).toBeVisible();
  await expect(page.locator('.react-pdf__Page canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('teacher-document-1365x900.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'toggle drawer', exact: true }).click();
  await expect(entry).not.toBeInViewport();
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(size);
    for (const label of ['Скачать PDF', 'Скачать Word', 'Уменьшить масштаб', 'Увеличить масштаб']) {
      const button = page.getByRole('button', { name: label, exact: true });
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const pdfViewport = page.getByRole('region', { name: 'Просмотр PDF', exact: true });
    await pdfViewport.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    expect(await pdfViewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => page.locator('.react-pdf__Page canvas').evaluate((element) => {
      const { right } = element.getBoundingClientRect();
      return right > 0 && right <= innerWidth;
    })).toBe(true);
    await pdfViewport.evaluate((element) => { element.scrollLeft = 0; });
    await page.screenshot({ path: testInfo.outputPath(`teacher-document-${size.width}x${size.height}.png`), animations: 'disabled' });
  }
});
