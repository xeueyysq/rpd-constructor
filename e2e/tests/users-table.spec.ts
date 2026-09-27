import { expect, test } from '@playwright/test';
import { filterColumn, showAllRows, signIn } from './helpers';

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
