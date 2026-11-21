import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { openTemplateFromTeacherList, signIn } from '../helpers';

test.describe('поиск книг для литературы', () => {
  test.describe.configure({ mode: 'serial' });

  const clientUrl = parseEnv(readFileSync(new URL('../../e2e.env', import.meta.url), 'utf8')).CLIENT_URL!;
  const biblio = 'Виноградов, В. А. База данных «Языки мира» / В. А. Виноградов. — 2003.';
  const duplicate = 'Дублирующая запись для теста';
  const universityBook = {
    id: 'https://lib.uni-dubna.ru/MegaPRO/UserEntry?ids=book-1',
    title: 'База данных «Языки мира»',
    author: 'Виноградов, В. А.',
    year: 2003,
    url: null,
    thumb: null,
    biblio,
    source: 'megapro',
  };
  const lanBook = {
    id: 'lan:fixture',
    title: 'Введение в языкознание',
    author: 'Иванова, А. В.',
    year: 2021,
    url: null,
    thumb: null,
    biblio: 'Иванова, А. В. Введение в языкознание. — 2021.',
    source: 'lan',
  };
  const uraitBook = {
    id: 'urait:fixture',
    title: 'Основы языкознания',
    author: 'Петров, В. А.',
    year: 2023,
    url: null,
    thumb: null,
    biblio: 'Петров, В. А. Основы языкознания. — 2023.',
    source: 'urait',
  };

  async function openResource(page: Page) {
    await signIn(page, 'teacher');
    await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: 'Литература для теста' }));
    await page.getByRole('button', { name: 'Ресурсное обеспечение' }).click();
    await expect(page.getByText('Основная литература', { exact: true })).toBeVisible();
  }

  test('общий поиск, сохранение литературы и доступность каталогов', async ({ page }) => {
    await page.route('**/api/find-books', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const { bookName, source } = route.request().postDataJSON() as { bookName: string; source?: string };
      const failed = bookName === 'Сбой';
      const partial = bookName === 'Частичный сбой';
      const available = partial ? [universityBook] : [uraitBook, universityBook, lanBook];
      await route.fulfill({
        status: failed ? 502 : 200,
        headers: {
          'access-control-allow-origin': clientUrl,
          'access-control-allow-credentials': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify(failed
          ? { status: 502, error: 'Каталоги библиотек недоступны. Попробуйте позже.' }
          : {
            books: source ? available.filter((book) => book.source === source) : available,
            truncated: bookName === 'Широкий запрос',
            ...(partial && { unavailableSources: ['lan', 'urait'] }),
          }),
      });
    });
    await openResource(page);

    const openSearch = page.getByRole('button', { name: 'Найти книги в каталогах' }).first();
    await openSearch.click();
    const dialog = page.getByRole('dialog', { name: 'Поиск книг в каталогах' });
    const input = dialog.getByRole('textbox', { name: 'Ключевые слова' });
    const search = async (query: string) => {
      await input.fill(query);
      await input.press('Enter');
    };

    const universityRow = dialog.getByRole('row').filter({ hasText: biblio });
    const lanRow = dialog.getByRole('row').filter({ hasText: lanBook.biblio });
    const uraitRow = dialog.getByRole('row').filter({ hasText: uraitBook.biblio });
    const addBooks = dialog.getByRole('button', { name: 'Добавить в список' });

    await expect(dialog.getByRole('combobox', { name: 'Каталог', exact: true })).toHaveCount(0);
    await search('Языки');
    await expect(universityRow.getByRole('cell', { name: 'МегаПро', exact: true })).toBeVisible();
    await expect(lanRow.getByRole('cell', { name: 'Лань', exact: true })).toBeVisible();
    await expect(uraitRow.getByRole('cell', { name: 'Юрайт', exact: true })).toBeVisible();
    const resultRows = dialog.getByRole('row').filter({ has: page.getByRole('cell') });
    await expect(resultRows.first()).toContainText(uraitBook.biblio);
    await universityRow.getByRole('checkbox').check();
    await uraitRow.getByRole('checkbox').check();
    const saved = page.waitForResponse((response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/update-json-value/112') && response.ok());
    await addBooks.click();
    await saved;
    await expect(page.getByText(uraitBook.biblio, { exact: true })).toBeVisible();

    await openSearch.click();
    await search('Языки');
    await universityRow.getByRole('checkbox').check();
    await addBooks.click();
    await expect(page.getByText(biblio, { exact: true })).toHaveCount(1);

    await openSearch.click();
    await search('Языки');
    await universityRow.getByRole('checkbox').check();
    await search('Повтор');
    await expect(addBooks).toBeDisabled();
    await expect(universityRow.getByRole('checkbox')).not.toBeChecked();

    await search('Частичный сбой');
    await expect(dialog.getByRole('alert')).toContainText('Лань, Юрайт');
    await expect(universityRow).toBeVisible();
    await universityRow.getByRole('checkbox').check();
    await expect(addBooks).toBeEnabled();

    await search('Широкий запрос');
    await expect(dialog.getByText(/Показаны не все найденные записи/)).toBeVisible();

    await search('Сбой');
    await expect(dialog.getByText('Каталоги библиотек недоступны. Попробуйте позже.')).toBeVisible();
    await expect(dialog.getByRole('table')).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(biblio, { exact: true })).toHaveCount(1);
    await expect(page.getByText(uraitBook.biblio, { exact: true })).toHaveCount(1);
    await expect(page.getByText(lanBook.biblio, { exact: true })).toHaveCount(0);
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
