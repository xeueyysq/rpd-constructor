import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { disciplines, openComplect, signIn } from '../helpers';

test('кнопка ФОС находится в комплекте и открывает компетенцию', async ({ page }) => {
  await signIn(page, 'admin');
  await expect(page.getByRole('button', { name: 'Собрать ФОСы' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Добавить содержание рпд' })).toHaveCount(0);
  await openComplect(page);
  await expect(page.getByRole('button', { name: 'Добавить содержание рпд' })).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await expect(row.getByRole('cell').nth(4).getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Собрать ФОСы' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сформировать ФОС' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Компетенция' })).toContainText('ТЕСТ-1 Анализировать учебные данные');
});

test('Excel ФОС скачивается как xlsx для всего комплекта', async ({ page }) => {
  await signIn(page, 'admin');
  await openComplect(page);
  await page.getByRole('button', { name: 'Собрать ФОСы' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сформировать ФОС' });
  await expect(dialog.getByRole('button', { name: 'Скачать Excel' })).toBeEnabled();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Скачать Excel' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('ФОС Синтетический профиль 2025.xlsx');
  const file = await download.path();
  expect(file).not.toBeNull();
  expect((await readFile(file!)).subarray(0, 2).toString()).toBe('PK');
});

test('без компетенций скачивание Word и Excel ФОС недоступно', async ({ page }) => {
  await page.route('**/api/get-results-data?*', (route) =>
    route.fulfill({ json: [] }));
  await signIn(page, 'admin');
  await openComplect(page);
  await page.getByRole('button', { name: 'Собрать ФОСы' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сформировать ФОС' });
  await expect(dialog.getByText(/В комплекте не найдены компетенции/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Скачать Excel' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Скачать Word' })).toBeDisabled();
});
