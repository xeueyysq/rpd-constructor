import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { expect, type Page } from '@playwright/test';

export const apiUrl = parseEnv(readFileSync(new URL('../e2e.env', import.meta.url), 'utf8')).API_URL!;

// Совпадает с паролем в seed.sql.
export const password = 'e2e-password';
export const disciplines = {
  inProgress: 'Алгоритмы для теста',
  ready: 'Базы данных для теста',
  unloaded: 'Сети для теста',
  workflow: 'Совместная работа для теста',
  deactivation: 'Деактивация для теста',
  sync: 'Синхронизация для теста',
  document: 'Лист согласования для теста',
  otherRop: 'РПД другого РОП для теста',
};

export const complects = {
  main: { profile: 'Синтетический профиль', uuid: '11111111-1111-4111-8111-111111111111' },
  other: { profile: 'Другой синтетический профиль', uuid: '22222222-2222-4222-8222-222222222222' },
} as const;

export async function signInWithCredentials(page: Page, userName: string, userPassword: string) {
  await page.goto('/sign-in');
  await page.getByRole('textbox', { name: 'Имя пользователя' }).fill(userName);
  await page.getByLabel('Пароль').fill(userPassword);
  await page.getByRole('button', { name: 'Войти' }).click();
}

export async function signIn(page: Page, userName: 'admin' | 'rop' | 'rop2' | 'teacher' | 'teacher2' | 'teacher3' | 'teacher4', userPassword = password) {
  await signInWithCredentials(page, userName, userPassword);
  if (userPassword === password) {
    await expect(page).toHaveURL(userName.startsWith('teacher') ? /\/templates$/ : /\/complects$/);
  }
}

export async function openComplect(page: Page, key: keyof typeof complects = 'main') {
  const complect = complects[key];
  await page.getByRole('row').filter({ has: page.getByRole('cell', { name: complect.profile, exact: true }) })
    .getByRole('button', { name: 'Комплект РПД' }).click();
  await expect(page).toHaveURL(new RegExp(`/complects/${complect.uuid}$`));
  await expect(page.getByRole('row').filter({ hasText: key === 'main' ? disciplines.inProgress : disciplines.otherRop })).toBeVisible();
}

export async function filterColumn(page: Page, column: string, value: string) {
  await page.getByRole('columnheader', { name: new RegExp(column) })
    .getByRole('button', { name: 'Действие колонки' }).click();
  await page.getByRole('menuitem', { name: `Отфильтровать по ${column}` }).click();
  await page.getByRole('textbox', { name: `Отфильтровать по ${column}` }).fill(value);
}

export async function showAllRows(page: Page) {
  // Таблица может перерисоваться после загрузки и закрыть меню — открываем заново.
  await expect(async () => {
    await page.getByRole('combobox', { name: 'Строк на странице' }).last().click();
    await page.getByRole('option', { name: '50', exact: true }).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}
