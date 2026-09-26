import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiUrl, disciplines, password, signIn, signInWithCredentials } from './helpers';

function uniqueLogin() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function userRow(page: Page, login: string) {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: login, exact: true }) });
}

async function openUsers(page: Page) {
  await signIn(page, 'admin');
  await page.getByText('Пользователи', { exact: true }).click();
  await expect(page.getByText('Управление пользователями', { exact: true })).toBeVisible();
}

async function adminToken(request: APIRequestContext) {
  const response = await request.post(`${apiUrl}/auth/sign-in`, {
    data: { userName: 'admin', password },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).accessToken as string;
}

test('админ создаёт и редактирует пользователя, меняет пароль', async ({ page, browser }) => {
  await openUsers(page);
  const originalLogin = uniqueLogin();
  const updatedLogin = `${originalLogin}x`;

  await page.getByRole('button', { name: 'Добавить пользователя' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Новый пользователь')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Логин' }).fill(originalLogin);
  await dialog.getByRole('textbox', { name: 'Фамилия' }).fill('Пробнов');
  await dialog.getByRole('textbox', { name: 'Имя', exact: true }).fill('Тест');
  await dialog.getByRole('textbox', { name: 'Отчество' }).fill('Тестович');
  await dialog.getByLabel('Пароль').fill(password);
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toBeHidden();

  await userRow(page, originalLogin).getByRole('button', { name: 'Действия строки' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Редактирование пользователя')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Логин' }).fill(updatedLogin);
  await dialog.getByRole('textbox', { name: 'Фамилия' }).fill('Обновлённов');
  await dialog.getByRole('textbox', { name: 'Имя', exact: true }).fill('Новый');
  await dialog.getByRole('combobox', { name: 'Роль' }).click();
  await page.getByRole('option', { name: 'РОП' }).click();
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toBeHidden();
  await expect(userRow(page, updatedLogin)).toContainText('Обновлённов Новый Тестович');
  await expect(userRow(page, updatedLogin)).toContainText('Руководитель образовательной программы');

  await userRow(page, updatedLogin).getByRole('button', { name: 'Действия строки' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Логин' }).fill('teacher2');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Логин' })).toHaveAccessibleDescription(
    'Пользователь с таким логином уже существует'
  );
  await dialog.getByRole('textbox', { name: 'Логин' }).fill(updatedLogin);
  await dialog.getByLabel('Новый пароль').fill('new-e2e-password');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toBeHidden();

  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const userPage = await context.newPage();
    await signInWithCredentials(userPage, updatedLogin, 'new-e2e-password');
    await expect(userPage).toHaveURL(/\/complects$/);
  } finally {
    await context.close();
  }
});

test('массовая деактивация отправляет один PATCH и запрещает вход', async ({ page, browser, request }) => {
  const token = await adminToken(request);
  const logins = [uniqueLogin(), uniqueLogin()];
  for (const login of logins) {
    const response = await request.post(`${apiUrl}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: login,
        password,
        role: 2,
        fullname: { surname: 'Пробнов', name: 'Тест', patronymic: 'Тестович' },
      },
    });
    expect(response.status()).toBe(201);
  }

  await openUsers(page);
  const patches: string[] = [];
  page.on('request', (requestEvent) => {
    if (requestEvent.method() === 'PATCH' && new URL(requestEvent.url()).pathname === '/api/users') {
      patches.push(requestEvent.url());
    }
  });
  for (const login of logins) {
    await userRow(page, login).getByRole('checkbox').check();
  }
  await page.getByRole('button', { name: 'Деактивировать (2)' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText('Деактивация пользователей')).toBeVisible();
  await confirm.getByRole('button', { name: 'Деактивировать' }).click();
  for (const login of logins) {
    await expect(userRow(page, login)).toContainText('Деактивирован');
  }
  expect(patches).toHaveLength(1);

  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const userPage = await context.newPage();
    await signInWithCredentials(userPage, logins[0], password);
    await expect(userPage).toHaveURL(/\/sign-in$/);
    await expect(userPage.getByText('Пользователь деактивирован')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('активация возвращает вход и привязанный шаблон', async ({ page, browser }) => {
  await openUsers(page);
  await userRow(page, 'retired').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Деактивировать (1)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Деактивировать' }).click();
  await expect(userRow(page, 'retired')).toContainText('Деактивирован');

  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const retiredPage = await context.newPage();
    await signInWithCredentials(retiredPage, 'retired', password);
    await expect(retiredPage).toHaveURL(/\/sign-in$/);
    await expect(retiredPage.getByText('Пользователь деактивирован')).toBeVisible();

    await userRow(page, 'retired').getByRole('button', { name: 'Действия строки' }).click();
    await page.getByRole('menuitem', { name: 'Активировать' }).click();
    await expect(userRow(page, 'retired')).toContainText('Активен');

    await signInWithCredentials(retiredPage, 'retired', password);
    await expect(retiredPage).toHaveURL(/\/templates$/);
    await expect(retiredPage.getByRole('row').filter({ hasText: disciplines.inProgress })).toBeVisible();
  } finally {
    await context.close();
  }
});
