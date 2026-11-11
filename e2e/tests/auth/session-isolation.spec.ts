import { expect, test, type Page } from '@playwright/test';
import { complects, disciplines, openComplect, password, signIn } from '../helpers';

const aimsTitle = 'Цели и задачи освоения дисциплины';
const editorA = '/templates/aaaaaaaaaaaa/aimsPage';
const complectA = `/complects/${complects.main.uuid}`;

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

// History API оставляет тот же документ и экземпляр приложения.
async function navigateInSpa(page: Page, path: string) {
  await page.evaluate((next) => {
    history.pushState({ ...history.state }, '', next);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await expect(page).toHaveURL(new URL(path, page.url()).href);
}

async function markDocument(page: Page) {
  await page.evaluate(() => { document.documentElement.dataset.sessionProbe = 'same-spa'; });
}

async function expectSameDocument(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-session-probe', 'same-spa');
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  await page.getByRole('menuitem', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

async function signInInOpenForm(page: Page, userName: string) {
  const signedIn = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/auth/sign-in'));
  await page.getByRole('textbox', { name: 'Имя пользователя' }).fill(userName);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  expect((await signedIn).status()).toBe(200);
}

async function expectEditorDenied(page: Page, path: string) {
  const denied = page.waitForResponse((response) =>
    response.url().endsWith('/api/rpd-profile-templates') && response.status() === 403);
  await navigateInSpa(page, path);
  await denied;
  await expect(page.getByRole('alert').filter({ hasText: 'Доступ к РПД запрещён.' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Редактировать', exact: true })).toHaveCount(0);
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0);
}

test('РОП A → logout → РОП B: Back и старый адрес не показывают кэш и действия A, включая позднюю загрузку', async ({ page }) => {
  await signIn(page, 'rop');
  await markDocument(page);
  await openComplect(page);
  await navigateInSpa(page, editorA);
  await expect(page.getByRole('main').getByText(aimsTitle, { exact: true })).toBeVisible();

  const started = gate();
  const responseGate = gate();
  let holdFirst = true;
  await page.route('**/api/find-rpd', async (route) => {
    if (!holdFirst) { await route.fallback(); return; }
    holdFirst = false;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    started.release();
    await responseGate.promise;
    await route.fulfill({ response });
  });
  try {
    await navigateInSpa(page, complectA);
    await started.promise;
    await logout(page);
    await signInInOpenForm(page, 'rop2');
    // Явный logout не возвращает на адрес A.
    await expect(page).toHaveURL(/\/complects$/);
    await expectSameDocument(page);

    const deniedEditor = page.waitForResponse((response) =>
      response.url().endsWith('/api/rpd-profile-templates') && response.status() === 403);
    await page.goBack();
    await deniedEditor;
    await expect(page.getByRole('alert').filter({ hasText: 'Доступ к РПД запрещён.' })).toBeVisible();

    const deniedComplect = page.waitForResponse((response) =>
      response.url().endsWith('/api/find-rpd') && response.status() === 403);
    await navigateInSpa(page, complectA);
    await deniedComplect;
    const refused = page.getByRole('alert').filter({ hasText: 'Доступ к комплекту запрещён.' });
    await expect(refused).toBeVisible();
    const late = page.waitForResponse((response) => response.url().endsWith('/api/find-rpd') && response.status() === 200);
    responseGate.release();
    await late;
    await expect(refused).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Импорт', exact: true })).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('progressbar')).toHaveCount(0);
    await expectEditorDenied(page, editorA);
    await expectEditorDenied(page, '/templates/100/aimsPage');
    await expectSameDocument(page);

    // Отдельно проверяем прямой URL уже после обоих входов в одном SPA.
    await page.goto(complectA);
    await expect(page.getByRole('alert').filter({ hasText: 'Доступ к комплекту запрещён.' })).toBeVisible();
  } finally {
    responseGate.release();
    await page.unroute('**/api/find-rpd');
  }
});

test('преподаватель A → B: список, черновик и статус сохранения A очищены без reload', async ({ page }) => {
  await signIn(page, 'teacher');
  await markDocument(page);
  await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toBeVisible();
  await navigateInSpa(page, editorA);
  await expect(page.getByRole('main').getByText(aimsTitle, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  const editor = page.locator('.textEditor [contenteditable="true"]');
  await editor.press('ControlOrMeta+a');
  await editor.pressSequentially('Черновик только пользователя A');
  await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toBeVisible();
  await logout(page);
  await signInInOpenForm(page, 'teacher3');
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole('row').filter({ hasText: disciplines.sync })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toHaveCount(0);
  await expectEditorDenied(page, editorA);
  await expect(page.getByText('Черновик только пользователя A')).toHaveCount(0);
  await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toHaveCount(0);
  await expectSameDocument(page);
});

test('позднее сохранение комментария A не меняет открытую РПД B и её статус', async ({ page }) => {
  await signIn(page, 'rop');
  await markDocument(page);
  await navigateInSpa(page, '/templates/a113a113a113/aimsPage');
  await page.getByRole('button', { name: 'Добавить комментарий', exact: true }).click();
  const editor = page.locator('.textEditor [contenteditable="true"]');
  await editor.pressSequentially('Поздний комментарий A');
  const started = gate();
  const responseGate = gate();
  // Только удерживаем ответ: тест не меняет общую seed-РПД.
  await page.route('**/api/upset-template-comment/113', async (route) => {
    started.release();
    await responseGate.promise;
    await route.fulfill({ json: { comment_text: '<p>Поздний комментарий A</p>', commentator_fullname: 'Пользователь A' } });
  });
  try {
    await page.getByRole('button', { name: 'Сохранить комментарий', exact: true }).click();
    await started.promise;
    await logout(page);
    await signInInOpenForm(page, 'rop2');
    await expect(page).toHaveURL(/\/complects$/);
    await navigateInSpa(page, '/templates/a109a109a109/aimsPage');
    await expect(page.getByRole('main').getByText(aimsTitle, { exact: true })).toBeVisible();
    const late = page.waitForResponse((response) => response.url().endsWith('/api/upset-template-comment/113'));
    responseGate.release();
    await late;
    // Следующий heartbeat B даёт завершиться обработке позднего ответа A.
    await page.waitForResponse((response) => response.url().endsWith('/api/templates/109/presence') && response.ok());
    await expect(page.getByText('Поздний комментарий A', { exact: true })).toHaveCount(0);
    const status = page.getByRole('status', { name: 'Сохранение и присутствие' });
    await expect(status).not.toContainText('Сохранение…');
    await expect(status).not.toContainText('Есть несохранённые изменения');
    await expect(status).not.toContainText('Сохранено в');
    await expectSameDocument(page);
  } finally {
    responseGate.release();
    await page.unroute('**/api/upset-template-comment/113');
  }
});

test('задержанный logout завершает удаление cookie до входа B; reload сохраняет B', async ({ page }) => {
  await signIn(page, 'rop');
  await markDocument(page);
  const started = gate();
  const responseGate = gate();
  await page.route('**/auth/logout', async (route) => {
    const response = await route.fetch();
    started.release();
    await responseGate.promise;
    await route.fulfill({ response });
  });
  try {
    await logout(page);
    await started.promise;
    await page.getByRole('textbox', { name: 'Имя пользователя' }).fill('rop2');
    await page.getByLabel('Пароль').fill(password);
    const signedIn = page.waitForResponse((response) => response.url().endsWith('/auth/sign-in'));
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeDisabled();
    const loggedOut = page.waitForResponse((response) => response.url().endsWith('/auth/logout'));
    responseGate.release();
    expect((await loggedOut).status()).toBe(200);
    expect((await signedIn).status()).toBe(200);
    await expect(page).toHaveURL(/\/complects$/);
    await expectSameDocument(page);
    await page.reload();
    await expect(page.getByRole('cell', { name: complects.other.profile, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: complects.main.profile, exact: true })).toHaveCount(0);
  } finally {
    responseGate.release();
    await page.unroute('**/auth/logout');
  }
});
