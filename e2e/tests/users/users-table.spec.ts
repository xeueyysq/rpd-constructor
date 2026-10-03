import { expect, test } from '@playwright/test';
import { filterColumn, showAllRows, signIn } from '../helpers';

async function openUsers(page: import('@playwright/test').Page) {
  await signIn(page, 'admin');
  await page.getByText('Пользователи', { exact: true }).click();
  await showAllRows(page);
  await expect(page.getByRole('row').filter({ hasText: 'teacher2' })).toBeVisible();
}

test('фильтр ФИО оставляет совпавшего пользователя', async ({ page }) => {
  await openUsers(page);
  await filterColumn(page, 'ФИО', 'Яковлева');
  await expect(page.getByRole('row').filter({ hasText: 'teacher2' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'teacher' }).filter({ hasNotText: 'teacher2' })).toHaveCount(0);
});

test('фильтр роли оставляет преподавателей, включая пользователя без ФИО', async ({ page }) => {
  await openUsers(page);
  await filterColumn(page, 'Роль', 'Преподаватель');
  await expect(page.getByRole('row').filter({ hasText: 'teacher2' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'nofio' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'rop' })).toHaveCount(0);
});

test('сортировка ФИО меняет порядок', async ({ page }) => {
  await openUsers(page);
  const header = page.getByRole('columnheader', { name: /ФИО/ });
  await header.getByRole('button', { name: 'Действие колонки' }).click();
  await page.getByRole('menuitem', { name: 'Сортировать ФИО по возрастанию' }).click();
  const rows = page.getByRole('rowgroup').last().getByRole('row');
  await expect.poll(async () => (await rows.allTextContents()).join(' ')).toMatch(/Альфина[\s\S]*Руководов[\s\S]*Яковлева/);
  await header.getByRole('button', { name: 'Действие колонки' }).click();
  await page.getByRole('menuitem', { name: 'Сортировать ФИО по убыванию' }).click();
  await expect.poll(async () => (await rows.allTextContents()).join(' ')).toMatch(/Яковлева[\s\S]*Руководов[\s\S]*Альфина/);
});

test('пользователь без ФИО отображается', async ({ page }) => {
  await openUsers(page);
  await expect(page.getByRole('row').filter({ hasText: 'nofio' })).toBeVisible();
});

test('колонка «Действия» последняя, заголовок не обрезан', async ({ page }) => {
  await openUsers(page);
  await expect(page.getByRole('columnheader')).toHaveText([/^$/, /^Логин/, /^ФИО/, /^Роль/, /^Статус/, /^Действия/]);
  const header = page.getByRole('columnheader', { name: /^Действия/ });
  await expect(header.getByRole('button')).toHaveCount(0);
  const label = await header.getByText('Действия', { exact: true }).evaluate((element) => ({
    scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
  }));
  expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
  const row = page.getByRole('row').filter({ hasText: 'teacher2' });
  await expect(row.getByRole('cell').last().getByRole('button', { name: 'Действия строки' })).toBeVisible();
});

// Метка пустого поля лежит внутри поля ввода и не съезжает вниз из-за подсказки под ним.
test('метка «Новый пароль» внутри поля ввода при подсказке под полем', async ({ page }) => {
  await openUsers(page);
  await page.getByRole('row').filter({ hasText: 'teacher2' }).getByRole('button', { name: 'Действия строки' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать' }).click();
  const dialog = page.getByRole('dialog');
  const input = dialog.getByLabel('Новый пароль');
  await expect(dialog.getByText('Оставьте пустым, чтобы не менять')).toBeVisible();
  const label = (await dialog.locator('label', { hasText: 'Новый пароль' }).boundingBox())!;
  const field = (await input.boundingBox())!;
  expect(label.y).toBeGreaterThanOrEqual(field.y);
  expect(label.y + label.height).toBeLessThanOrEqual(field.y + field.height);
  expect(Math.abs(label.y + label.height / 2 - (field.y + field.height / 2))).toBeLessThanOrEqual(2);
});
