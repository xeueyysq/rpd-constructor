import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { apiUrl, disciplines, openComplect, password, signIn } from '../helpers';

test.describe('кнопочное сохранение комментариев РОП', () => {
  test.describe.configure({ mode: 'serial' });

  const title = 'Цели и задачи освоения дисциплины';
  const author = 'Автор: Руководов Тест Тестович';
  const endpoint = '/api/upset-template-comment/100';
  let headers: Record<string, string>;

  async function savedComment(request: APIRequestContext) {
    const profile = await request.post(`${apiUrl}/api/rpd-profile-templates`, {
      headers, data: { id: 100 },
    });
    expect(profile.ok()).toBeTruthy();
    return (await profile.json()).comments.aimsPage;
  }

  async function clearComment(request: APIRequestContext) {
    const comment = await savedComment(request);
    if (comment) {
      const deleted = await request.delete(`${apiUrl}/api/delete-template-comment/${comment.id}`, { headers });
      expect(deleted.status()).toBe(204);
    }
  }

  async function openAims(page: Page) {
    // Открываем шаблон из списка, без goto/reload: при параллельных входах (TD-13) перезагрузка теряет сессию.
    await signIn(page, 'rop');
    await openComplect(page);
    await page.getByRole('row').filter({ hasText: disciplines.inProgress })
      .getByRole('button', { name: 'Меню шаблона' }).click();
    await page.getByRole('menuitem', { name: 'Открыть' }).click();
    await page.getByRole('button', { name: title }).click();
    await expect(page.getByRole('main').getByText(title, { exact: true })).toBeVisible();
  }

  function collab(page: Page) {
    return page.getByRole('navigation', { name: 'Разделы РПД' })
      .getByRole('status', { name: 'Сохранение и присутствие' });
  }

  function watchPuts(page: Page) {
    const puts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().endsWith(endpoint)) {
        puts.push(request.url());
      }
    });
    return puts;
  }

  async function enterComment(page: Page, text: string) {
    const editor = page.locator('.textEditor [contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    await editor.press('ControlOrMeta+a');
    await editor.pressSequentially(text);
    return editor;
  }

  async function blurComment(page: Page) {
    const heartbeat = page.waitForResponse((response) =>
      response.url().endsWith('/api/templates/100/presence') && response.ok());
    await page.getByRole('main').getByText(title, { exact: true }).click();
    await heartbeat;
  }

  test.beforeEach(async ({ request }) => {
    const signedIn = await request.post(`${apiUrl}/auth/sign-in`, {
      data: { userName: 'rop', password },
    });
    expect(signedIn.ok()).toBeTruthy();
    headers = { Authorization: `Bearer ${(await signedIn.json()).accessToken as string}` };
    await clearComment(request);
  });

  test.afterEach(async ({ request }) => {
    await clearComment(request);
  });

  test('ввод и blur не сохраняют, кнопка отправляет один PUT и сохраняет ФИО автора', async ({ page, request }) => {
    await openAims(page);
    const puts = watchPuts(page);
    await page.getByRole('button').filter({ has: page.locator('[data-testid="AddCommentIcon"]') }).click();
    const draft = 'Комментарий сохраняется только кнопкой';
    const editor = await enterComment(page, draft);
    await blurComment(page);
    expect(puts).toHaveLength(0);
    await expect(editor).toHaveText(draft);
    await expect(collab(page).getByText('Есть несохранённые изменения')).toBeVisible();

    // Задерживаем настоящий PUT, чтобы проверить блокировку повторного сохранения.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`**${endpoint}`, async (route) => {
      if (route.request().method() === 'PUT') await gate;
      await route.fallback();
    });
    const saved = page.waitForResponse((response) =>
      response.request().method() === 'PUT' && response.url().endsWith(endpoint) && response.ok());
    const saveButton = page.getByRole('button', { name: 'Сохранить комментарий' });
    await saveButton.click();
    try {
      await expect(saveButton).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Отменить', exact: true })).toBeDisabled();
      await expect(collab(page).getByText('Сохранение…')).toBeVisible();
    } finally {
      release();
    }
    const response = await saved;
    expect((await response.json()).commentator_fullname).toBe('Руководов Тест Тестович');
    expect(puts).toHaveLength(1);
    await expect(page.getByText(author, { exact: true })).toBeVisible();
    await expect(page.getByText(draft, { exact: true })).toBeVisible();
    await expect(collab(page).getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
    const comment = await savedComment(request);
    expect(comment.comment_text).toContain(draft);
    expect(comment.commentator_fullname).toBe('Руководов Тест Тестович');
  });

  test('отмена возвращает исходный комментарий и автора без PUT', async ({ page, request }) => {
    const original = 'Исходный комментарий РОП';
    const seeded = await request.put(`${apiUrl}${endpoint}`, {
      headers, data: { field: 'aimsPage', value: `<p>${original}</p>` },
    });
    expect(seeded.ok()).toBeTruthy();
    await openAims(page);
    await expect(page.getByText(author, { exact: true })).toBeVisible();
    const puts = watchPuts(page);
    await page.getByRole('button', { name: 'Редактировать', exact: true }).first().click();
    await enterComment(page, 'Отменённый черновик');
    await blurComment(page);
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    await expect(page.getByText(original, { exact: true })).toBeVisible();
    await expect(page.getByText(author, { exact: true })).toBeVisible();
    await expect(collab(page).getByText('Есть несохранённые изменения')).toHaveCount(0);
    expect(puts).toHaveLength(0);
    const comment = await savedComment(request);
    expect(comment.comment_text).toContain(original);
    expect(comment.commentator_fullname).toBe('Руководов Тест Тестович');
  });

  test('отмена нового комментария не создаёт запись', async ({ page }) => {
    await openAims(page);
    const puts = watchPuts(page);
    await page.getByRole('button').filter({ has: page.locator('[data-testid="AddCommentIcon"]') }).click();
    await enterComment(page, 'Новый комментарий отменяется');
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    await expect(page.getByText('Новый комментарий отменяется')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Сохранить комментарий' })).toHaveCount(0);
    await expect(collab(page).getByText('Есть несохранённые изменения')).toHaveCount(0);
    expect(puts).toHaveLength(0);
  });

  test('ошибка оставляет комментарий открытым и повторное сохранение возвращает ФИО', async ({ page }) => {
    await openAims(page);
    await page.getByRole('button').filter({ has: page.locator('[data-testid="AddCommentIcon"]') }).click();
    const draft = 'Черновик комментария после ошибки';
    const editor = await enterComment(page, draft);
    let failNext = true;
    await page.route(`**${endpoint}`, async (route) => {
      if (route.request().method() !== 'PUT' || !failNext) return route.fallback();
      failNext = false;
      await route.fulfill({
        status: 500, contentType: 'application/json',
        headers: {
          'access-control-allow-origin': new URL(page.url()).origin,
          'access-control-allow-credentials': 'true',
        },
        body: JSON.stringify({ message: 'Ошибка сервера' }),
      });
    });
    await page.getByRole('button', { name: 'Сохранить комментарий' }).click();
    await expect(page.getByText('Ошибка сохранения данных')).toBeVisible();
    await expect(editor).toHaveText(draft);
    await expect(collab(page).getByText('Есть несохранённые изменения')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить комментарий' })).toBeEnabled();
    const saved = page.waitForResponse((response) =>
      response.request().method() === 'PUT' && response.url().endsWith(endpoint) && response.ok());
    await page.getByRole('button', { name: 'Сохранить комментарий' }).click();
    await saved;
    await expect(page.getByText(author, { exact: true })).toBeVisible();
    await expect(page.getByText(draft, { exact: true })).toBeVisible();
  });
});
