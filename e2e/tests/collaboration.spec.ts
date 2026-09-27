import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

test.describe('совместное редактирование шаблона', () => {
  test.describe.configure({ mode: 'serial' });

  const discipline = 'Совместное редактирование для теста';
  const title = 'Цели и задачи освоения дисциплины';
  const goals = 'Цели обновлены преподавателем';
  const conflictGoals = 'Цели после разрешения конфликта';

  async function openAims(page: Page) {
    const presence = page.waitForResponse((response) =>
      response.url().endsWith('/api/templates/110/presence') && response.ok());
    await page.getByRole('row').filter({ hasText: discipline })
      .getByRole('button', { name: 'Открыть' }).click();
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
      await expect(secondPage.getByText('Сейчас в шаблоне: Альфина Т.Т.')).toBeVisible();
      await expect(page.getByText('Сейчас в шаблоне: Яковлева Т.Т.')).toBeVisible();
    } finally {
      await secondContext.close();
    }
  });

  test('изменение по blur появляется у второго преподавателя без перезагрузки', async ({ page, browser }) => {
    await signIn(page, 'teacher');
    await openAims(page);

    const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const secondPage = await secondContext.newPage();
      await signIn(secondPage, 'teacher2');
      await openAims(secondPage);
      await expect(secondPage.getByText('Исходные цели совместной работы')).toBeVisible();

      await editGoals(page, goals);
      const saved = page.waitForResponse((response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/update-json-value/110') && response.ok());
      await blurGoals(page);
      await saved;
      await expect(page.getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
      await expect(page.getByText('Данные успешно сохранены')).toHaveCount(0);
      await expect(secondPage.getByText(goals, { exact: true })).toBeVisible();
      await expect(secondPage.getByText(/Изменено: Альфина Т\.Т\./)).toHaveCount(2);

      await page.getByRole('button', { name: 'Список РПД' }).click();
      await expect(page).toHaveURL(/\/templates$/);
      await openAims(page);
      await expect(page.getByText(goals, { exact: true })).toBeVisible();
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
      await blurGoals(page);
      await saved;
      await expect(page.getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
      const conflict = secondPage.waitForResponse((response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/api/update-json-value/110') &&
        response.status() === 409);
      await blurGoals(secondPage);
      await conflict;
      await expect(secondPage.getByText(/Поле уже изменено: Альфина Т\.Т\./)).toBeVisible();
      await expect(secondPage.getByText(conflictGoals, { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Список РПД' }).click();
      await expect(page).toHaveURL(/\/templates$/);
      await openAims(page);
      await expect(page.getByText(conflictGoals, { exact: true })).toBeVisible();
    } finally {
      await secondContext.close();
    }
  });
});
