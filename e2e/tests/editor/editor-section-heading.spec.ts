import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { apiUrl, disciplines, openComplect, password, signIn } from '../helpers';

// Страница «Место дисциплины» шаблона 100: её комментарий и правки поля place_more_text не использует ни один другой сценарий.
test.describe('отметка «Изменено» относится к заголовку раздела, а не к комментарию', () => {
  test.describe.configure({ mode: 'serial' });

  const title = 'Место дисциплины в структуре ОПОП';
  const commentField = 'disciplinePlace';
  const endpoint = '/api/upset-template-comment/100';
  const comment = 'Комментарий к заголовку раздела';
  let headers: Record<string, string>;

  async function profile(request: APIRequestContext) {
    const response = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers, data: { id: 100 } });
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async function clearComment(request: APIRequestContext) {
    const existing = (await profile(request)).comments[commentField];
    if (existing) {
      const deleted = await request.delete(`${apiUrl}/api/delete-template-comment/${existing.id}`, { headers });
      expect(deleted.status()).toBe(204);
    }
  }

  async function seedComment(request: APIRequestContext) {
    const seeded = await request.put(`${apiUrl}${endpoint}`, {
      headers, data: { field: commentField, value: `<p>${comment}</p>` },
    });
    expect(seeded.ok()).toBeTruthy();
  }

  // Открываем шаблон из списка, без перезагрузки страницы: как в остальных сценариях редактора.
  async function openPlace(page: Page, userName: 'rop' | 'teacher') {
    await signIn(page, userName);
    const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
    if (userName === 'rop') {
      await openComplect(page);
      await row.getByRole('button', { name: 'Меню шаблона' }).click();
      await page.getByRole('menuitem', { name: 'Открыть' }).click();
    } else {
      await row.getByRole('button', { name: 'Открыть' }).click();
    }
    await page.getByRole('button', { name: title }).click();
    await expect(page.getByRole('main').getByText(title, { exact: true })).toBeVisible();
  }

  async function box(locator: Locator) {
    const result = await locator.boundingBox();
    expect(result).not.toBeNull();
    return result!;
  }

  // Контейнер заголовка — непосредственный родитель отметки: первым в нём идёт строка с названием страницы.
  async function labelContainerHasTitle(label: Locator) {
    return label.evaluate((element) => element.parentElement?.firstElementChild?.textContent ?? '');
  }

  test.beforeEach(async ({ request }) => {
    const signedIn = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName: 'rop', password } });
    expect(signedIn.ok()).toBeTruthy();
    headers = { Authorization: `Bearer ${(await signedIn.json()).accessToken as string}` };
    await clearComment(request);
    const current = await profile(request);
    if (!current.field_edits?.place_more_text) {
      const edited = await request.put(`${apiUrl}/api/update-json-value/100`, {
        headers,
        data: { fieldToUpdate: 'place_more_text', value: '<p>Правка для отметки</p>', baseAt: null },
      });
      expect(edited.ok()).toBeTruthy();
    }
  });

  test.afterEach(async ({ request }) => {
    await clearComment(request);
  });

  test('без комментария отметка стоит вплотную под заголовком, кнопка комментария — в строке заголовка', async ({ page }) => {
    await openPlace(page, 'rop');
    const main = page.getByRole('main');
    const heading = main.getByText(title, { exact: true });
    const label = main.getByText(/^Изменено:/).first();
    await expect(label).toBeVisible();
    expect(await labelContainerHasTitle(label)).toContain(title);

    const titleBox = await box(heading);
    const labelBox = await box(label);
    expect(labelBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
    expect(labelBox.y - (titleBox.y + titleBox.height)).toBeLessThan(12);

    const addComment = main.getByRole('button', { name: 'Добавить комментарий' });
    const addBox = await box(addComment);
    expect(Math.abs(addBox.y + addBox.height / 2 - (titleBox.y + titleBox.height / 2))).toBeLessThan(titleBox.height);
    expect(addBox.y + addBox.height).toBeLessThanOrEqual(labelBox.y + 1);
  });

  for (const userName of ['rop', 'teacher'] as const) {
    test(`с комментарием (${userName}) отметка остаётся у заголовка, комментарий — отдельный блок ниже`, async ({ page, request }) => {
      await seedComment(request);
      await openPlace(page, userName);
      const main = page.getByRole('main');
      const heading = main.getByText(title, { exact: true });
      const label = main.getByText(/^Изменено:/).first();
      const commentTitle = main.getByText('Комментарий', { exact: true });
      await expect(label).toBeVisible();
      await expect(commentTitle).toBeVisible();
      await expect(main.getByText(comment, { exact: true })).toBeVisible();
      expect(await labelContainerHasTitle(label)).toContain(title);
      // Кнопки «Добавить комментарий» при существующем комментарии нет.
      await expect(main.getByRole('button', { name: 'Добавить комментарий' })).toHaveCount(0);

      const titleBox = await box(heading);
      const labelBox = await box(label);
      const commentBox = await box(commentTitle);
      const toTitle = labelBox.y - (titleBox.y + titleBox.height);
      const toComment = commentBox.y - (labelBox.y + labelBox.height);
      expect(toTitle).toBeLessThan(12);
      // До комментария — явный отступ темы (не меньше 16px) и заметно больше, чем до заголовка.
      expect(toComment).toBeGreaterThanOrEqual(16);
      expect(toComment).toBeGreaterThan(toTitle * 2);
      // Комментарий не входит в контейнер заголовка, где лежит отметка.
      const commentHandle = await commentTitle.elementHandle();
      expect(await label.evaluate((element, target) => element.parentElement?.contains(target), commentHandle)).toBe(false);
    });
  }
});
