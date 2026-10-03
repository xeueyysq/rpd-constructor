import { expect, test, type Page } from '@playwright/test';
import { openTemplateFromTeacherList, signIn } from '../helpers';

test.describe('совместное редактирование шаблона', () => {
  test.describe.configure({ mode: 'serial' });

  const discipline = 'Совместное редактирование для теста';
  const title = 'Цели и задачи освоения дисциплины';
  const goals = 'Цели обновлены преподавателем';
  const conflictGoals = 'Цели после разрешения конфликта';
  const sections = (page: Page) => page.getByRole('navigation', { name: 'Разделы РПД' });
  const collab = (page: Page) => sections(page).getByRole('status', { name: 'Сохранение и присутствие' });

  async function openAims(page: Page) {
    const presence = page.waitForResponse((response) =>
      response.url().endsWith('/api/templates/110/presence') && response.ok());
    await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: discipline }));
    await presence;
    await page.getByRole('button', { name: title }).click();
    await expect(page.getByText(title, { exact: true }).last()).toBeVisible();
  }

  async function editGoals(page: Page, value: string) {
    await page.getByRole('button', { name: 'Редактировать' }).click();
    const editor = page.locator('.textEditor [contenteditable="true"]');
    await expect(editor).toBeVisible();
    // Draft.js не всегда очищает текст при fill: выделяем всё и печатаем поверх.
    await editor.press('ControlOrMeta+a');
    await editor.pressSequentially(value);
  }

  async function blurGoals(page: Page) {
    await page.getByText(title, { exact: true }).last().click();
  }

  test('оба преподавателя видят присутствие друг друга', async ({ page, browser }) => {
    await signIn(page, 'teacher');
    await openAims(page);

    const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const secondPage = await secondContext.newPage();
      await signIn(secondPage, 'teacher2');
      await openAims(secondPage);
      await expect(collab(secondPage).getByText('Сейчас в шаблоне: Альфина Т.Т.')).toBeVisible();
      await expect(collab(page).getByText('Сейчас в шаблоне: Яковлева Т.Т.')).toBeVisible();
      await expect(page.getByRole('main').getByText(/Сейчас в шаблоне:/)).toHaveCount(0);
    } finally {
      await secondContext.close();
    }
  });

  test('blur не сохраняет, кнопка отправляет один PUT и обновляет второго преподавателя', async ({ page, browser }) => {
    await signIn(page, 'teacher');
    await openAims(page);

    const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const secondPage = await secondContext.newPage();
      await signIn(secondPage, 'teacher2');
      await openAims(secondPage);
      await expect(secondPage.getByText('Исходные цели совместной работы')).toBeVisible();

      const puts: string[] = [];
      page.on('request', (request) => {
        if (request.method() === 'PUT' && request.url().includes('/api/update-json-value/110')) {
          puts.push(request.url());
        }
      });
      await editGoals(page, goals);
      const heartbeat = page.waitForResponse((response) =>
        response.url().endsWith('/api/templates/110/presence') && response.ok());
      await blurGoals(page);
      await heartbeat;
      expect(puts).toHaveLength(0);
      await expect(page.locator('.textEditor [contenteditable="true"]')).toHaveText(goals);
      await expect(collab(page).getByText('Есть несохранённые изменения')).toBeVisible();
      await expect(secondPage.getByText('Исходные цели совместной работы')).toBeVisible();
      const saved = page.waitForResponse((response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/update-json-value/110') && response.ok());
      await page.getByRole('button', { name: 'Сохранить изменения' }).click();
      await saved;
      expect(puts).toHaveLength(1);
      await expect(collab(page).getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
      await expect(page.getByText('Данные успешно сохранены')).toHaveCount(0);
      await expect(secondPage.getByText(goals, { exact: true })).toBeVisible();
      await expect(collab(secondPage).getByText(/Изменено: Альфина Т\.Т\./)).toBeVisible();
      await expect(secondPage.getByRole('main').getByText(/Изменено: Альфина Т\.Т\./)).toBeVisible();

      await page.getByRole('button', { name: 'Список РПД' }).click();
      await expect(page).toHaveURL(/\/templates$/);
      await openAims(page);
      await expect(page.getByText(goals, { exact: true })).toBeVisible();
      await expect(collab(page).getByText(/Сохранено в/)).toHaveCount(0);
    } finally {
      await secondContext.close();
    }
  });

  test('устаревший черновик получает конфликт и актуальные цели', async ({ page, browser }) => {
    await signIn(page, 'teacher');
    await openAims(page);

    const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const secondPage = await secondContext.newPage();
      await signIn(secondPage, 'teacher2');
      await openAims(secondPage);

      await editGoals(page, conflictGoals);
      await editGoals(secondPage, 'Конкурирующие цели второго преподавателя');
      const saved = page.waitForResponse((response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/update-json-value/110') && response.ok());
      await page.getByRole('button', { name: 'Сохранить изменения' }).click();
      const saveResponse = await saved;
      await expect(collab(page).getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
      // Heartbeat не затирает открытый черновик и его исходную отметку baseAt.
      const heartbeat = secondPage.waitForResponse((response) =>
        response.url().endsWith('/api/templates/110/presence') && response.ok());
      await heartbeat;
      const secondEditor = secondPage.locator('.textEditor [contenteditable="true"]');
      await expect(secondEditor).toHaveText('Конкурирующие цели второго преподавателя');
      const conflict = secondPage.waitForResponse((response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/update-json-value/110') &&
        response.status() === 409);
      await secondPage.getByRole('button', { name: 'Сохранить изменения' }).click();
      const conflictResponse = await conflict;
      expect(conflictResponse.request().postDataJSON().baseAt)
        .toBe(saveResponse.request().postDataJSON().baseAt);
      await expect(secondPage.getByText(/Поле уже изменено: Альфина Т\.Т\./)).toBeVisible();
      await expect(secondEditor).toHaveText('Конкурирующие цели второго преподавателя');
      await expect(collab(secondPage).getByText('Есть несохранённые изменения')).toBeVisible();
      await secondPage.getByRole('button', { name: 'Отменить', exact: true }).click();
      await expect(collab(secondPage).getByText('Есть несохранённые изменения')).toHaveCount(0);
      await expect(secondPage.getByText(conflictGoals, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Список РПД' }).click();
      await expect(page).toHaveURL(/\/templates$/);
      await openAims(page);
      await expect(page.getByText(conflictGoals, { exact: true })).toBeVisible();
    } finally {
      await secondContext.close();
    }
  });

  test('отмена текстового черновика возвращает исходные цели без PUT', async ({ page }) => {
    await signIn(page, 'teacher');
    await openAims(page);
    const puts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().includes('/api/update-json-value/110')) {
        puts.push(request.url());
      }
    });
    await editGoals(page, 'Этот черновик отменяется');
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    await expect(page.getByText(conflictGoals, { exact: true })).toBeVisible();
    await expect(collab(page).getByText('Есть несохранённые изменения')).toHaveCount(0);
    expect(puts).toHaveLength(0);
  });

  test('ошибка сохранения оставляет текстовый черновик для повторной попытки', async ({ page }) => {
    await signIn(page, 'teacher');
    await openAims(page);
    let failNext = true;
    await page.route('**/api/update-json-value/110', async (route) => {
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
    const draft = 'Цели после повторного сохранения';
    await editGoals(page, draft);
    await page.getByRole('button', { name: 'Сохранить изменения' }).click();
    await expect(page.getByText('Ошибка сохранения данных')).toBeVisible();
    await expect(page.locator('.textEditor [contenteditable="true"]')).toHaveText(draft);
    await expect(collab(page).getByText('Есть несохранённые изменения')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toBeEnabled();
    const saved = page.waitForResponse((response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/update-json-value/110') && response.ok());
    await page.getByRole('button', { name: 'Сохранить изменения' }).click();
    await saved;
    await expect(page.getByText(draft, { exact: true })).toBeVisible();
    await expect(collab(page).getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
  });

  test('панель на низком экране сохраняет доступ к статусу и нижним кнопкам', async ({ page }) => {
    await signIn(page, 'rop');
    await page.goto('/templates/a110a110a110/aimsPage');
    await expect(page.getByRole('main').getByText(title, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 480 });
    await expect(collab(page)).toBeInViewport();
    await expect(sections(page).getByRole('button', { name: 'Сформировать документ' })).toBeInViewport();
    await expect(sections(page).getByRole('button', { name: 'Список РПД' })).toBeInViewport();
  });
});
