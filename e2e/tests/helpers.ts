import { expect, type Page } from '@playwright/test';

// Совпадает с паролем в seed.sql.
export const password = 'e2e-password';
export const disciplines = {
  inProgress: 'Алгоритмы для теста',
  ready: 'Базы данных для теста',
  unloaded: 'Сети для теста',
};

export async function signIn(page: Page, userName: 'admin' | 'rop' | 'teacher', userPassword = password) {
  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Имя пользователя' }).fill(userName);
  await page.getByLabel('Пароль').fill(userPassword);
  await page.getByRole('button', { name: 'Войти' }).click();
  if (userPassword === password) {
    await expect(page).toHaveURL(userName === 'teacher' ? /\/templates$/ : /\/complects$/);
  }
}

export async function openComplect(page: Page) {
  await page.getByRole('button', { name: 'Комплект РПД' }).click();
  await expect(page).toHaveURL(/\/complects\/11111111-1111-4111-8111-111111111111$/);
  await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toBeVisible();
}

export async function filterColumn(page: Page, column: string, value: string) {
  await page.getByRole('columnheader', { name: new RegExp(column) })
    .getByRole('button', { name: 'Действие колонки' }).click();
  await page.getByRole('menuitem', { name: `Отфильтровать по ${column}` }).click();
  await page.getByRole('textbox', { name: `Отфильтровать по ${column}` }).fill(value);
}
