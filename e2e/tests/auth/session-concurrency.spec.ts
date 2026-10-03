import { expect, test, type Page } from '@playwright/test';
import { apiUrl, password, signIn } from '../helpers';

const templatePath = '/templates/aaaaaaaaaaaa/aimsPage';
const title = 'Цели и задачи освоения дисциплины';

async function expectAims(page: Page, path = templatePath) {
  await expect(page).toHaveURL(new URL(path, page.url()).href);
  await expect(page.getByRole('main').getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открыть меню аккаунта' })).toBeVisible();
}

async function reloadAndAct(page: Page, path = templatePath) {
  const refreshed = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/auth/refresh'));
  await page.reload();
  const refreshResponse = await refreshed;
  expect(refreshResponse.status()).toBe(200);
  await expectAims(page, path);
  // Используем токен настоящего refresh браузера для защищённого действия.
  const { accessToken } = await refreshResponse.json();
  const presence = await page.request.post(`${apiUrl}/api/templates/100/presence`, {
    headers: { Authorization: `Bearer ${accessToken as string}` },
  });
  expect(presence.ok()).toBeTruthy();
}

test('две сессии одного РОП переживают параллельный reload; logout A сохраняет сессию B', async ({ page, browser }) => {
  const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const secondPage = await secondContext.newPage();
    await Promise.all([signIn(page, 'rop'), signIn(secondPage, 'rop')]);
    await Promise.all([page.goto(templatePath), secondPage.goto(templatePath)]);
    await Promise.all([expectAims(page), expectAims(secondPage)]);
    await Promise.all([reloadAndAct(page), reloadAndAct(secondPage)]);

    const loggedOut = page.waitForResponse((response) => response.url().endsWith('/auth/logout'));
    await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
    await page.getByRole('menuitem', { name: 'Выйти', exact: true }).click();
    expect((await loggedOut).ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/sign-in$/);
    await reloadAndAct(secondPage);
  } finally {
    await secondContext.close();
  }
});

test('reload страницы раздела сохраняет точный URL, query и hash', async ({ page }) => {
  await signIn(page, 'rop');
  const path = `${templatePath}?tab=goals#section`;
  await page.goto(path);
  await expectAims(page, path);
  await reloadAndAct(page, path);
});

test('активная роль «Преподаватель» у РОП переживает reload раздела', async ({ page }) => {
  await signIn(page, 'rop');
  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  await page.getByRole('menuitem', { name: 'Преподаватель', exact: true }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await page.goto(templatePath);
  await expectAims(page);
  await reloadAndAct(page);
  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  await expect(page.getByRole('menuitem', { name: 'Преподаватель', exact: true })).toHaveClass(/Mui-selected/);
  await expect(page.getByRole('menuitem', { name: 'Руководитель образовательной программы' })).not.toHaveClass(/Mui-selected/);
});

test('после входа возвращается исходный раздел с query и hash', async ({ page }) => {
  const path = `${templatePath}?tab=goals#section`;
  await page.goto(path);
  await expect(page).toHaveURL(/\/sign-in$/);
  // Заполняем уже открытую форму, сохраняя location.state.from.
  await page.getByRole('textbox', { name: 'Имя пользователя' }).fill('rop');
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expectAims(page, path);
});
