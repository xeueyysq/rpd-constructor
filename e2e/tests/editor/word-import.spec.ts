import { expect, test } from '@playwright/test';
import { apiUrl, signIn } from '../helpers';
import { headersFor, profileFor } from '../list3';

test('Word: ошибка файла, отмена, выбор полей, применение и конфликт ревизии', async ({ page, request }, testInfo) => {
  test.slow();
  const headers = await headersFor(request);
  const admin = await headersFor(request, 'admin');
  const generated = await request.get(`${apiUrl}/api/generate-docx?id=300`, { headers: admin });
  expect(generated.status()).toBe(200);
  const docx = await generated.body();
  const before = await profileFor(request, headers, 390);
  await signIn(page, 'rop');
  await page.goto('/templates/a390a390a390/aimsPage');
  const open = page.getByRole('button', { name: 'Импортировать из Word', exact: true });
  await expect(open.locator('svg')).toHaveCount(1);
  await open.hover();
  await expect(page.getByRole('tooltip', { name: 'Импортировать из Word', exact: true })).toBeVisible();
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать из Word' });
  const file = dialog.locator('input[type="file"]');
  await expect(dialog).not.toContainText('Цель:');
  await file.setInputFiles({ name: 'broken.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('invalid') });
  await expect(dialog.getByRole('alert').last()).toContainText(/не удалось|некоррект|DOCX|файл/i);
  await file.setInputFiles({ name: 'synthetic.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx });
  await expect(dialog.getByRole('checkbox', { name: 'Цели и задачи' })).toBeVisible();
  await expect(dialog).toContainText('Источник:');
  for (const width of [1365, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const panel = await dialog.boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Продолжить', exact: true })).toBeInViewport();
    const trigger = page.getByRole('button', { name: 'Сообщить о проблеме', exact: true });
    await expect(trigger).toHaveCount(1);
    const box = await trigger.boundingBox();
    expect(box!.x).toBeCloseTo(16, 0);
    expect(box!.y).toBeGreaterThanOrEqual(panel!.y + panel!.height);
  }
  await page.setViewportSize({ width: 1365, height: 900 });
  await dialog.screenshot({ path: testInfo.outputPath('word-preview.png') });
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  expect((await profileFor(request, headers, 390)).goals).toBe(before.goals);

  await open.click();
  await file.setInputFiles({ name: 'synthetic.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx });
  const goals = dialog.getByRole('checkbox', { name: 'Цели и задачи' });
  await expect(goals).toBeChecked();
  for (const checkbox of await dialog.getByRole('checkbox').all()) {
    if ((await checkbox.evaluate((element) => element.closest('label')?.textContent?.trim())) !== 'Цели и задачи') {
      if (await checkbox.isChecked()) await checkbox.uncheck();
    }
  }
  await dialog.getByRole('radio', { name: 'Заменить существующее' }).check();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const applyPath = `${apiUrl}/api/templates/390/import-word/apply`;
  await page.route(applyPath, async (route) => {
    await gate;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Повторите попытку' }) });
  });
  const held = page.waitForResponse((response) => response.url() === applyPath && response.request().method() === 'POST');
  const started = page.waitForRequest((request) => request.url() === applyPath && request.method() === 'POST');
  await dialog.getByRole('button', { name: 'Импортировать выбранные поля' }).click();
  await started;
  try {
    await expect(dialog.getByRole('button', { name: 'Выбрать РПД из комплекта' })).toBeDisabled();
    await expect(file).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Импортировать выбранные поля' })).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: 'Цели и задачи' })).toBeChecked();
    await expect(dialog).toContainText('Источник:');
  } finally {
    release();
  }
  expect((await held).status()).toBe(503);
  await page.unroute(applyPath);
  await expect(dialog.getByRole('checkbox', { name: 'Цели и задачи' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: 'Заменить существующее' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/templates/390/import-word/apply`);
  await dialog.getByRole('button', { name: 'Импортировать выбранные поля' }).click();
  const applied = await saved;
  expect(applied.status()).toBe(200);
  expect(applied.request().postDataJSON().selectedFields).toEqual(['goals']);
  expect(Object.keys(applied.request().postDataJSON().values)).toEqual(['goals']);
  const after = await profileFor(request, headers, 390);
  expect(after.goals).not.toBe(before.goals);
  expect(after.textbook).toEqual(before.textbook);

  await open.click();
  await file.setInputFiles({ name: 'synthetic.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx });
  await expect(goals).toBeVisible();
  const changed = await request.put(`${apiUrl}/api/update-json-value/390`, { headers, data: {
    fieldToUpdate: 'goals', value: '<p>Изменено после предпросмотра</p>', baseAt: after.field_edits?.goals?.at ?? null,
  } });
  expect(changed.status()).toBe(200);
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  const conflict = page.waitForResponse((response) => response.url() === `${apiUrl}/api/templates/390/import-word/apply`);
  await dialog.getByRole('button', { name: 'Импортировать выбранные поля' }).click();
  expect((await conflict).status()).toBe(409);
  await expect(dialog).toContainText('Обновите данные и подтвердите действие повторно');
  await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
  expect((await profileFor(request, headers, 390)).goals).toBe('<p>Изменено после предпросмотра</p>');
});
