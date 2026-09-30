import { expect, test, type Page } from '@playwright/test';
import { openComplect, signIn } from '../helpers';

test.describe.configure({ mode: 'serial' });

const discipline = 'Часы для теста';

async function openContent(page: Page) {
  await page.getByRole('button', { name: 'Содержание дисциплины' }).click();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toBeVisible();
}

const rules = (page: Page) => page.getByRole('button', { name: 'Правила заполнения' });
const mismatchAlert = (page: Page) =>
  page.getByRole('alert').filter({ hasText: 'Часы не совпадают с учебным планом' });

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

  // Значок правил стоит у заголовка страницы, а не в строке «Итого».
  await expect(rules(page)).toHaveCount(1);
  await expect(total.getByRole('button', { name: 'Правила заполнения' })).toHaveCount(0);
  const heading = await page.getByRole('main').getByText('Содержание дисциплины', { exact: true }).first().boundingBox();
  const help = await rules(page).boundingBox();
  const tableBox = await page.getByRole('table', { name: 'Содержание дисциплины' }).boundingBox();
  expect(Math.abs((help!.y + help!.height / 2) - (heading!.y + heading!.height / 2))).toBeLessThan(heading!.height);
  expect(help!.y + help!.height).toBeLessThanOrEqual(tableBox!.y);

  await rules(page).hover();
  await expect(page.getByRole('tooltip')).toContainText('Контактная работа — это лекции и практические занятия вместе с лабораторными');
  await expect(page.getByRole('tooltip')).toContainText('Часы контроля вводятся в строке «Промежуточная аттестация»');
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  // С клавиатуры: Tab задаёт режим фокуса, затем значок получает фокус и подсказка открывается.
  await page.keyboard.press('Tab');
  await rules(page).focus();
  await expect(page.getByRole('tooltip')).toContainText('Всего часов — контактная работа, самостоятельная работа и контроль');
  await page.keyboard.press('Escape');

  // Стиль таблицы как у «Планируемых результатов»: серая шапка, отступ в ячейке темы, итоги без рамки.
  const table = page.getByRole('table', { name: 'Содержание дисциплины' });
  await expect(table.getByRole('columnheader').first()).toHaveCSS('background-color', 'rgb(236, 239, 241)');
  await expect(table.getByRole('columnheader').first()).toHaveCSS('font-weight', '600');
  const firstRow = table.getByRole('row').filter({ hasText: 'Тема 1' });
  await expect(firstRow.getByRole('cell').first()).toHaveCSS('padding-left', '16px');
  await expect(mismatchAlert(page)).toHaveCount(0);

  // Расхождение: предупреждение с перечнем несовпавших категорий, после выравнивания исчезает.
  const lectures = firstRow.getByRole('spinbutton').first();
  await lectures.fill('18');
  await expect(mismatchAlert(page)).toHaveText(
    'Часы не совпадают с учебным планом: всего 145 из 144; лекции 35 из 34; контактная работа 69 из 68.');
  await expect(mismatchAlert(page)).not.toContainText('СРС');
  await lectures.fill('17');
  await expect(mismatchAlert(page)).toHaveCount(0);

  const theme = firstRow.getByRole('textbox').first();
  await theme.fill('Тема 1 уточнена');
  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PUT' &&
    response.url().includes('/api/update-json-value/103') && response.ok());
  await rules(page).click();
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
  // Итоговый ввод без видимой рамки, как ячейки таблицы.
  await expect(independentWork.locator('..').locator('fieldset')).toHaveCSS('border-top-style', 'none');
  await expect(mismatchAlert(page)).toHaveCount(0);
  await independentWork.fill('32');
  await expect(mismatchAlert(page)).toHaveText(
    'Часы не совпадают с учебным планом: СРС 31 из 32.');
  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PUT' &&
    response.url().includes('/api/rpd-profile-templates/103/study-load') && response.ok());
  await rules(page).click();
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
