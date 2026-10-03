import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { openTemplateFromTeacherList, signIn } from '../helpers';

test.describe('поиск книг для литературы', () => {
  test.describe.configure({ mode: 'serial' });

  const clientUrl = parseEnv(readFileSync(new URL('../../e2e.env', import.meta.url), 'utf8')).CLIENT_URL!;
  const biblio = 'Виноградов, В. А. База данных «Языки мира» / В. А. Виноградов. — 2003.';
  const duplicate = 'Дублирующая запись для теста';
  const book = {
    id: 'https://lib.uni-dubna.ru/MegaPRO/UserEntry?ids=book-1',
    title: 'База данных «Языки мира»',
    author: 'Виноградов, В. А.',
    year: 2003,
    url: null,
    thumb: null,
    biblio,
  };

  async function openResource(page: Page) {
    await signIn(page, 'teacher');
    await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: 'Литература для теста' }));
    await page.getByRole('button', { name: 'Ресурсное обеспечение' }).click();
    await expect(page.getByText('Основная литература', { exact: true })).toBeVisible();
  }

  test('поиск, добавление, повтор, сброс выбора и ошибки каталога', async ({ page }) => {
    await page.route('**/api/find-books', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const { bookName } = route.request().postDataJSON() as { bookName: string };
      const error = bookName === 'Сбой';
      await route.fulfill({
        status: error ? 502 : 200,
        headers: {
          'access-control-allow-origin': clientUrl,
          'access-control-allow-credentials': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify(error
          ? { status: 502, error: 'Каталог библиотеки не ответил вовремя. Уточните запрос или попробуйте позже.' }
          : { books: [book], truncated: bookName === 'Широкий запрос' }),
      });
    });
    await openResource(page);

    const openSearch = page.getByRole('button', { name: 'Найти книги в библиотечной системе' }).first();
    await openSearch.click();
    const dialog = page.getByRole('dialog', { name: 'Поиск книг в библиотечной системе' });
    const input = dialog.getByRole('textbox', { name: 'Ключевые слова' });
    const search = async (query: string) => {
      await input.fill(query);
      await input.press('Enter');
    };

    await search('Виноградов');
    const resultRow = dialog.getByRole('row').filter({ hasText: biblio });
    await expect(resultRow).toBeVisible();
    await resultRow.getByRole('checkbox').check();
    const saved = page.waitForResponse((response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/update-json-value/112') && response.ok());
    await dialog.getByRole('button', { name: 'Добавить в список' }).click();
    const firstSave = await saved;
    expect(firstSave.request().postDataJSON()).toMatchObject({ fieldToUpdate: 'textbook', value: [biblio] });
    await expect(page.getByText(biblio, { exact: true })).toHaveCount(1);

    const putRequests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' && request.url().includes('/api/update-json-value/112')) {
        putRequests.push(request.url());
      }
    });
    await openSearch.click();
    await search('Виноградов');
    await dialog.getByRole('row').filter({ hasText: biblio }).getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Добавить в список' }).click();
    await expect(page.getByText(biblio, { exact: true })).toHaveCount(1);
    expect(putRequests).toHaveLength(0);

    await openSearch.click();
    await search('Виноградов');
    await dialog.getByRole('row').filter({ hasText: biblio }).getByRole('checkbox').check();
    await search('Повтор');
    await expect(dialog.getByRole('row').filter({ hasText: biblio }).getByRole('checkbox')).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Добавить в список' })).toBeDisabled();

    await search('Сбой');
    await expect(dialog.getByText('Каталог библиотеки не ответил вовремя. Уточните запрос или попробуйте позже.')).toBeVisible();
    await expect(dialog.getByRole('table')).toHaveCount(0);

    await search('Широкий запрос');
    await expect(dialog.getByText('Показаны не все найденные записи. Уточните запрос: добавьте автора или год издания.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Отмена' }).click();

    await page.getByRole('button', { name: 'Список РПД' }).click();
    await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: 'Литература для теста' }));
    await page.getByRole('button', { name: 'Ресурсное обеспечение' }).click();
    await expect(page.getByText(biblio, { exact: true })).toHaveCount(1);
  });

  test('удаление первой одинаковой записи оставляет вторую', async ({ page }) => {
    await openResource(page);
    await expect(page.getByText(duplicate, { exact: true })).toHaveCount(2);
    const saved = page.waitForResponse((response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/update-json-value/112') && response.ok());
    await page.getByRole('button', { name: 'Удалить книгу 1' }).last().click();
    const response = await saved;
    expect(response.request().postDataJSON()).toMatchObject({
      fieldToUpdate: 'additional_textbook',
      value: [duplicate],
    });
    await expect(page.getByText(duplicate, { exact: true })).toHaveCount(1);
  });
});
