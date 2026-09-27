import { expect, test, type Page } from '@playwright/test';
import { openComplect, signIn } from './helpers';

test.describe.configure({ mode: 'serial' });

const discipline = 'Часы для теста';

async function openContent(page: Page) {
  await page.getByRole('button', { name: 'Содержание дисциплины' }).click();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toBeVisible();
}

function totalRow(page: Page) {
  return page.getByRole('table', { name: 'Содержание дисциплины' })
    .getByRole('row').filter({ hasText: 'Итого за семестр / курс' });
}

test('преподаватель сохраняет содержание без изменения плана 1С', async ({ page }) => {
  await signIn(page, 'teacher2');
  await page.getByRole('row').filter({ hasText: discipline }).getByRole('button', { name: 'Открыть' }).click();
  await openContent(page);

  const total = totalRow(page);
  await expect(total.getByRole('spinbutton')).toHaveCount(0);
  for (const [column, value] of [[1, 144], [4, 68], [5, 31], [6, 45]] as const) {
    await expect(total.getByRole('cell').nth(column)).toContainText(new RegExp(`/\\s*${value}$`));
  }
  await page.getByRole('button', { name: 'Правила заполнения таблицы' }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Контактная работа = Лекции + Практические занятия');
  await expect(page.getByRole('tooltip')).toContainText('Справа — данные учебного плана 1С');

  const theme = page.getByRole('table', { name: 'Содержание дисциплины' })
    .getByRole('row').filter({ hasText: 'Тема 1' }).getByRole('textbox').first();
  await theme.fill('Тема 1 уточнена');
  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PUT' &&
    response.url().includes('/api/update-json-value/103') && response.ok());
  await page.getByRole('button', { name: 'Правила заполнения таблицы' }).click();
  await saved;
  await expect(page.getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
  await expect(page.getByText('Данные успешно сохранены')).toHaveCount(0);
  await page.getByRole('button', { name: 'Конструктор РПД' }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await page.getByRole('row').filter({ hasText: discipline }).getByRole('button', { name: 'Открыть' }).click();
  await openContent(page);
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toContainText('Тема 1 уточнена');
  await expect(totalRow(page).getByRole('cell').nth(1)).toContainText(/\/\s*144$/);
  await expect(totalRow(page).getByRole('cell').nth(5)).toContainText(/\/\s*31$/);
});

test('РОП редактирует часы плана и видит сохранённое значение после перехода', async ({ page }) => {
  await signIn(page, 'rop');
  await openComplect(page);
  await page.getByRole('row').filter({ hasText: discipline })
    .getByRole('button', { name: 'Меню шаблона' }).click();
  await page.getByRole('menuitem', { name: 'Открыть' }).click();
  await openContent(page);

  const independentWork = totalRow(page).getByRole('cell').nth(5).getByRole('spinbutton');
  await expect(independentWork).toHaveValue('31');
  await independentWork.fill('32');
  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PUT' &&
    response.url().includes('/api/rpd-profile-templates/103/study-load') && response.ok());
  await page.getByRole('button', { name: 'Правила заполнения таблицы' }).click();
  await saved;
  await expect(page.getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
  await expect(page.getByText('Данные успешно сохранены')).toHaveCount(0);
  await page.getByRole('button', { name: 'Конструктор РПД' }).click();
  await expect(page).toHaveURL(/\/complects$/);
  await openComplect(page);
  await page.getByRole('row').filter({ hasText: discipline })
    .getByRole('button', { name: 'Меню шаблона' }).click();
  await page.getByRole('menuitem', { name: 'Открыть' }).click();
  await openContent(page);
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toBeVisible();
  await expect(totalRow(page).getByRole('cell').nth(5).getByRole('spinbutton')).toHaveValue('32');
});
