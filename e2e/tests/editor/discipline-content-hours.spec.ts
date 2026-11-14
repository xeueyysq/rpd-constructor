import { expect, test, type Page } from '@playwright/test';
import { apiUrl, openComplect, openTemplateFromTeacherList, password, signIn, signInWithCredentials } from '../helpers';
import { headersFor, list3, preservedImportData, profileFor, templateFromDb } from '../list3';

test.describe.configure({ mode: 'serial' });

const discipline = 'Часы для теста';
const editActions = (page: Page) => page.getByRole('group', { name: 'Редактирование содержания дисциплины' });
const contentTable = (page: Page) => page.getByRole('table', { name: 'Содержание дисциплины', exact: true });
const contentWrite = (url: string) => /\/api\/(?:update-json-value\/103|rpd-profile-templates\/103\/study-load)$/.test(url);


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

test('преподаватель явно сохраняет содержание без изменения плана 1С', async ({ page, request }) => {
  await signIn(page, 'teacher2');
  await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: discipline }));
  await openContent(page);

  const headers = await headersFor(request, 'teacher2');
  const before = await profileFor(request, headers, 103);
  const historyResponse = await request.post(`${apiUrl}/api/get-template-history`, { headers, data: { id: 103 } });
  expect(historyResponse.status()).toBe(200);
  const historyBefore = await historyResponse.json();
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'PUT' && contentWrite(request.url())) writes.push(request.url()); });
  await expect(contentTable(page).getByRole('textbox')).toHaveCount(0);
  await expect(contentTable(page).getByRole('spinbutton')).toHaveCount(0);
  await expect(editActions(page).getByRole('button', { name: 'Добавить строку' })).toHaveCount(0);
  // Автоматическая строка аттестации не превращает неизменённый черновик в запись.
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editActions(page).getByRole('button', { name: 'Редактировать' })).toBeVisible();
  expect(writes).toEqual([]);
  const total = totalRow(page);
  await expect(total.getByRole('spinbutton')).toHaveCount(0);
  for (const [column, value] of [[1, 144], [4, 68], [5, 31], [6, 45]] as const) {
    await expect(total.getByRole('cell').nth(column)).toHaveText(new RegExp(`^${value}\\s*/\\s*${value}$`));
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

  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await expect(total.getByRole('spinbutton')).toHaveCount(0);
  await expect(table.getByRole('button', { name: /^Очистить контроль:/ })).toHaveCount(0);

  // Расхождение: предупреждение с перечнем несовпавших категорий, после выравнивания исчезает.
  const lectures = firstRow.getByRole('spinbutton').first();
  await lectures.fill('18');
  await expect(total.getByRole('cell').nth(2)).toHaveText(/^34\s*\/\s*35$/);
  await expect(mismatchAlert(page)).toHaveText(
    'Часы не совпадают с учебным планом: всего 145 из 144; лекции 35 из 34; контактная работа 69 из 68.');
  await expect(mismatchAlert(page)).not.toContainText('СРС');
  await lectures.fill('17');
  await expect(mismatchAlert(page)).toHaveCount(0);

  const theme = firstRow.getByRole('textbox').first();
  await theme.fill('Тема 1 уточнена');
  await rules(page).click();
  expect((await profileFor(request, headers, 103)).content).toEqual(before.content);
  expect(templateFromDb(103).content).toEqual(before.content);
  expect(writes).toEqual([]);
  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PUT' &&
    response.url().includes('/api/update-json-value/103') && response.ok());
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  const receipt = await (await saved).json();
  expect(receipt.edit).toMatchObject({ userId: 10, fullname: 'Яковлева Т.Т.' });
  expect(Number.isNaN(Date.parse(receipt.edit.at))).toBe(false);
  const after = await profileFor(request, headers, 103);
  expect(after.content['0'].theme).toBe('Тема 1 уточнена');
  expect(after.study_load).toEqual(before.study_load);
  expect(after.field_edits.content.at).toBe(receipt.edit.at);
  const historyAfter = await request.post(`${apiUrl}/api/get-template-history`, { headers, data: { id: 103 } });
  expect(historyAfter.status()).toBe(200);
  expect(await historyAfter.json()).toEqual(historyBefore);
  expect(templateFromDb(103)).toMatchObject({ content: after.content, study_load: before.study_load,
    field_edits: { content: { userId: 10, at: receipt.edit.at } } });
  await expect(page.getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
  await expect(page.getByText('Данные успешно сохранены')).toHaveCount(0);
  await page.getByRole('button', { name: 'Конструктор РПД' }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: discipline }));
  await openContent(page);
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toContainText('Тема 1 уточнена');
  await expect(totalRow(page).getByRole('cell').nth(1)).toHaveText(/^144\s*\/\s*144$/);
  await expect(totalRow(page).getByRole('cell').nth(5)).toHaveText(/^31\s*\/\s*31$/);
});

test('РОП явно сохраняет часы плана и видит сохранённое значение после перехода', async ({ page, request }) => {
  await signIn(page, 'rop');
  await openComplect(page);
  await page.getByRole('row').filter({ hasText: discipline })
    .getByRole('link', { name: discipline, exact: true }).click();
  await openContent(page);

  const headers = await headersFor(request);
  const before = await profileFor(request, headers, 103);
  await expect(contentTable(page).getByRole('spinbutton')).toHaveCount(0);
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
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
  expect((await profileFor(request, headers, 103)).study_load).toEqual(before.study_load);
  expect(templateFromDb(103).study_load).toEqual(before.study_load);
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  const receipt = await (await saved).json();
  expect(receipt.edits.study_load.userId).toBe(1);
  expect(Number.isNaN(Date.parse(receipt.edits.study_load.at))).toBe(false);
  expect(templateFromDb(103)).toMatchObject({ study_load: receipt.study_load,
    field_edits: { study_load: { userId: 1, at: receipt.edits.study_load.at } } });
  await expect(page.getByText(/Сохранено в \d{2}:\d{2}/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0);
  await expect(page.getByText('Данные успешно сохранены')).toHaveCount(0);
  await page.getByRole('button', { name: 'Конструктор РПД' }).click();
  await expect(page).toHaveURL(/\/complects$/);
  await openComplect(page);
  await page.getByRole('row').filter({ hasText: discipline })
    .getByRole('link', { name: discipline, exact: true }).click();
  await openContent(page);
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toBeVisible();
  await expect(totalRow(page).getByRole('cell').nth(5)).toHaveText(/^32\s*\/\s*31$/);
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();

  // Ноль из учебного плана остаётся числом, а не прочерком после сохранения.
  await totalRow(page).getByRole('cell').nth(2).getByRole('spinbutton').fill('0');
  const zeroSaved = page.waitForResponse((response) =>
    response.request().method() === 'PUT' &&
    response.url().includes('/api/rpd-profile-templates/103/study-load') && response.ok());
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await zeroSaved;
  await page.reload();
  await openContent(page);
  await expect(totalRow(page).getByRole('cell').nth(2)).toHaveText(/^0\s*\//);
});

test('пары плана и суммы остаются внутри своих итоговых ячеек', async ({ page }, testInfo) => {
  await signIn(page, 'rop');
  await openComplect(page);
  await page.getByRole('row').filter({ hasText: discipline })
    .getByRole('link', { name: discipline, exact: true }).click();
  await openContent(page);

  const table = page.getByRole('table', { name: 'Содержание дисциплины' });
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await table.getByRole('row').filter({ hasText: 'Тема 1' }).getByRole('spinbutton').first().fill('1000.5');
  const plannedTotal = totalRow(page).getByRole('cell').nth(1).getByRole('spinbutton');
  await plannedTotal.fill('1127.5');
  await expect(plannedTotal).toHaveValue('1127.5');
  await expect(totalRow(page).getByRole('cell').nth(1)).toHaveText(/\/\s*1127\.5$/);

  for (const width of [1280, 960, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await table.screenshot({ path: testInfo.outputPath(`content-layout-${width}.png`) });
    const overflow = await totalRow(page).getByRole('cell').evaluateAll((cells) =>
      cells.slice(1).flatMap((cell, index) => {
        const bounds = cell.getBoundingClientRect();
        const pair = cell.firstElementChild!;
        const escaped = [pair, ...pair.querySelectorAll('input, span')].some((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
        });
        const clippedInput = [...pair.querySelectorAll('input')].some((input) =>
          input.scrollWidth > input.clientWidth + 1);
        return escaped || clippedInput ? [index + 1] : [];
      }));
    expect(overflow, `Итоги вышли за границы ячеек при ширине ${width}`).toEqual([]);
  }
  await editActions(page).getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(editActions(page).getByRole('button', { name: 'Редактировать' })).toBeVisible();
});

test('legacy контроль: преподаватель не очищает, РОП явно уменьшает итог, остальные данные сохраняются', async ({ page, request }, testInfo) => {
  const headers = await headersFor(request);
  const before = await profileFor(request, headers, list3.control.id);
  await signIn(page, 'teacher');
  await page.goto(`/templates/${list3.control.publicId}/disciplineContent`);
  const table = page.getByRole('table', { name: 'Содержание дисциплины' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('button', { name: /^Очистить контроль:/ })).toHaveCount(0);
  const topic = table.getByRole('row').filter({ hasText: 'Legacy тема' });
  await expect(topic.getByRole('cell').nth(6)).toHaveText('2');
  await expect(topic.getByRole('cell').nth(6).getByRole('spinbutton')).toHaveCount(0);
  await expect(totalRow(page).getByRole('cell').first()).toContainText('В учебном плане / В РПД');
  await expect(totalRow(page).getByRole('cell').nth(6)).toHaveText(/^36\s*\/\s*38$/);
  await page.reload();
  await expect(topic.getByRole('cell').nth(6)).toHaveText('2');
  expect(templateFromDb(list3.control.id).content, 'Открытие не должно автоматически исправлять legacy часы').toEqual(before.content);

  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  const loggedOut = page.waitForResponse((response) => response.url() === `${apiUrl}/auth/logout`
    && response.request().method() === 'POST');
  await page.getByRole('menuitem', { name: 'Выйти', exact: true }).click();
  expect((await loggedOut).ok()).toBe(true);
  await expect(page).toHaveURL(/\/sign-in$/);
  await signInWithCredentials(page, 'rop', password);
  await expect(page).toHaveURL(/\/complects$/);
  await page.goto(`/templates/${list3.control.publicId}/disciplineContent`);
  await expect(page).toHaveURL(new RegExp(`/templates/${list3.control.publicId}/disciplineContent$`));
  await expect(page.getByRole('button', { name: 'Открыть меню аккаунта' })).toContainText('Руководитель образовательной программы');
  await expect(contentTable(page).getByRole('spinbutton')).toHaveCount(0);
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  const clear = topic.getByRole('button', { name: 'Очистить контроль: Legacy тема', exact: true });
  await expect(clear).toBeEnabled();
  await expect(totalRow(page).getByRole('cell').nth(6).getByRole('spinbutton')).toHaveValue('36');
  await expect(totalRow(page).getByRole('cell').nth(6)).toHaveText(/\/\s*38$/);
  await clear.click();
  expect(templateFromDb(list3.control.id).content).toEqual(before.content);
  await editActions(page).getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(topic.getByRole('cell').nth(6)).toHaveText('2');
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await clear.click();
  const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/update-json-value/316`
    && response.request().method() === 'PUT');
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const expectedContent = { ...before.content, 0: { ...before.content[0], control: 0 } };
  expect(response.request().postDataJSON()).toEqual({ fieldToUpdate: 'content', value: expectedContent, baseAt: before.field_edits?.content?.at ?? null });
  expect((await response.json()).value).toEqual(expectedContent);
  await expect(clear).toHaveCount(0);
  await expect(topic.getByRole('cell').nth(6)).toHaveText('0');
  await expect(totalRow(page).getByRole('cell').nth(6)).toHaveText(/\/\s*36$/);
  await table.screenshot({ path: testInfo.outputPath('legacy-control-cleared.png') });
  await page.reload();
  await expect(topic.getByRole('cell').nth(6)).toHaveText('0');
  await expect(totalRow(page).getByRole('cell').nth(6)).toHaveText(/\/\s*36$/);
  const after = await profileFor(request, headers, list3.control.id);
  expect(after.content).toEqual(expectedContent);
  expect(preservedImportData(after)).toEqual(preservedImportData(before));
  expect(templateFromDb(list3.control.id)).toMatchObject({ content: expectedContent, ...preservedImportData(before) });
});

test('отмена отбрасывает строки и часы, загружает текущий сервер и сохраняет независимый текстовый черновик', async ({ page, request }) => {
  await signIn(page, 'rop');
  await page.goto('/templates/cccccccccccc/disciplineContent');
  const headers = await headersFor(request);
  const before = await profileFor(request, headers, 103);
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'PUT' && contentWrite(request.url())) writes.push(request.url()); });
  await expect(contentTable(page)).toBeVisible();
  // Соседний редактор должен пережить отмену таблицы и остаться dirty.
  await page.getByRole('button', { name: 'Редактировать', exact: true }).nth(1).click();
  const text = page.locator('.textEditor [contenteditable="true"]');
  await text.press('ControlOrMeta+a');
  await text.pressSequentially('Независимое дополнение');
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await contentTable(page).getByRole('textbox').first().fill('Отменяемая тема');
  await totalRow(page).getByRole('cell').nth(5).getByRole('spinbutton').fill('987');
  await editActions(page).getByRole('button', { name: 'Добавить строку' }).click();
  await contentTable(page).getByRole('textbox').last().fill('Отменяемая строка');
  await rules(page).click();
  expect(templateFromDb(103).content).toEqual(before.content);
  expect(templateFromDb(103).study_load).toEqual(before.study_load);
  const value = { ...before.content, '0': { ...before.content['0'], theme: 'Актуальная тема после отмены' } };
  const changed = await request.put(`${apiUrl}/api/update-json-value/103`, { headers,
    data: { fieldToUpdate: 'content', value, baseAt: before.field_edits?.content?.at ?? null } });
  expect(changed.status()).toBe(200);
  const presence = page.waitForResponse((response) => response.url().endsWith('/api/templates/103/presence') && response.ok());
  await presence;
  await expect(contentTable(page).getByRole('textbox').first()).toHaveValue('Отменяемая тема');
  await expect(totalRow(page).getByRole('cell').nth(5).getByRole('spinbutton')).toHaveValue('987');
  await editActions(page).getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(contentTable(page)).toContainText('Актуальная тема после отмены');
  await expect(contentTable(page)).not.toContainText('Отменяемая строка');
  await expect(contentTable(page).getByRole('textbox')).toHaveCount(0);
  await expect(text).toHaveText('Независимое дополнение');
  await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  // Повторный вход не наследует touched/values из отменённого плана.
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await expect(totalRow(page).getByRole('cell').nth(5).getByRole('spinbutton')).toHaveValue(String(before.study_plan_hours.independent_work));
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editActions(page).getByRole('button', { name: 'Редактировать' })).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
});

test('503 сохраняет черновик для повтора; реальный 409 удерживает ревизию начала сессии до отмены', async ({ page, request }) => {
  await signIn(page, 'teacher2');
  await page.goto('/templates/cccccccccccc/disciplineContent');
  await expect(contentTable(page)).toBeVisible();
  const headers = await headersFor(request, 'teacher2');
  const before = await profileFor(request, headers, 103);
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  const theme = contentTable(page).getByRole('textbox').first();
  await theme.fill('Черновик после 503');
  await page.route('**/api/update-json-value/103', (route) => route.fulfill({ status: 503,
    contentType: 'application/json', body: '{"error":"temporarily unavailable"}' }), { times: 1 });
  const failed = page.waitForResponse((response) => response.url().endsWith('/api/update-json-value/103') && response.status() === 503);
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await failed;
  await expect(page.getByRole('alert').filter({ hasText: 'Содержание не сохранено.' })).toBeVisible();
  await expect(theme).toHaveValue('Черновик после 503');
  expect(templateFromDb(103).content).toEqual(before.content);
  const retried = page.waitForResponse((response) => response.url().endsWith('/api/update-json-value/103') && response.ok());
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  const retryResponse = await retried;
  expect(retryResponse.request().postDataJSON().baseAt).toBe(before.field_edits?.content?.at ?? null);
  await expect(editActions(page).getByRole('button', { name: 'Редактировать' })).toBeVisible();
  const confirmed = await profileFor(request, headers, 103);
  expect(confirmed.content['0'].theme).toBe('Черновик после 503');
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await theme.fill('Конфликтующий черновик');
  const value = { ...confirmed.content, '0': { ...confirmed.content['0'], theme: 'Чужая актуальная тема' } };
  const competing = await request.put(`${apiUrl}/api/update-json-value/103`, { headers,
    data: { fieldToUpdate: 'content', value, baseAt: confirmed.field_edits.content.at } });
  expect(competing.status()).toBe(200);
  for (let attempt = 0; attempt < 2; attempt++) {
    const conflict = page.waitForResponse((response) => response.url().endsWith('/api/update-json-value/103') && response.status() === 409);
    await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect((await conflict).request().postDataJSON().baseAt).toBe(confirmed.field_edits.content.at);
    await expect(theme).toHaveValue('Конфликтующий черновик');
    await expect(editActions(page).getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
    expect(templateFromDb(103).content).toEqual(value);
  }
  await editActions(page).getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(contentTable(page)).toContainText('Чужая актуальная тема');
  await page.reload();
  await expect(contentTable(page)).toContainText('Чужая актуальная тема');
});

test('содержание сохраняется раньше пакета часов; частичная ошибка повторяет только несохранённое и допускает отмену остатка', async ({ page, request }) => {
  await signIn(page, 'rop');
  await page.goto('/templates/cccccccccccc/disciplineContent');
  await expect(contentTable(page)).toBeVisible();
  const headers = await headersFor(request);
  const before = await profileFor(request, headers, 103);
  const writes: Array<{ url: string; body: Record<string, unknown> }> = [];
  page.on('request', (request) => { if (request.method() === 'PUT' && contentWrite(request.url())) writes.push({ url: request.url(), body: request.postDataJSON() }); });
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  const theme = contentTable(page).getByRole('textbox').first();
  const planned = totalRow(page).getByRole('cell').nth(5).getByRole('spinbutton');
  await theme.fill('Сохранённая часть черновика');
  await planned.fill('-1');
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Часы должны быть' })).toBeVisible();
  expect(writes).toEqual([]);
  const hours = { independent_work: before.study_plan_hours.independent_work + 1, seminars: before.study_plan_hours.seminars + 1 };
  await planned.fill(String(hours.independent_work));
  await totalRow(page).getByRole('cell').nth(3).getByRole('spinbutton').fill(String(hours.seminars));
  const failPlanOnce = () => page.route('**/api/rpd-profile-templates/103/study-load', (route) => route.fulfill({ status: 503,
    contentType: 'application/json', body: '{"error":"temporarily unavailable"}' }), { times: 1 });
  await failPlanOnce();
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Содержание сохранено, часы учебного плана не сохранены.' })).toBeVisible();
  await expect(theme).toHaveValue('Сохранённая часть черновика');
  await expect(planned).toHaveValue(String(hours.independent_work));
  expect(writes.map((write) => write.url.split('/api/')[1])).toEqual(['update-json-value/103', 'rpd-profile-templates/103/study-load']);
  expect(writes[1].body).toEqual({ hours });
  const partial = await profileFor(request, headers, 103);
  expect(partial.content['0'].theme).toBe('Сохранённая часть черновика');
  expect(partial.study_load).toEqual(before.study_load);
  await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toBeVisible();
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editActions(page).getByRole('button', { name: 'Редактировать' })).toBeVisible();
  expect(writes).toHaveLength(3);
  expect(writes[2].body).toEqual({ hours });
  const after = await profileFor(request, headers, 103);
  expect(after.field_edits.content.at).toBe(partial.field_edits.content.at);
  expect(after.study_plan_hours).toMatchObject(hours);
  expect(templateFromDb(103)).toMatchObject({ content: after.content, study_load: after.study_load });
  await page.reload();
  await expect(contentTable(page)).toContainText('Сохранённая часть черновика');
  // Ещё один частичный успех: отмена отбрасывает только несохранённый план.
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await theme.fill('Сохранённое содержание после отмены остатка');
  await planned.fill(String(hours.independent_work + 1));
  await failPlanOnce();
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Содержание сохранено, часы учебного плана не сохранены.' })).toBeVisible();
  await editActions(page).getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(contentTable(page)).toContainText('Сохранённое содержание после отмены остатка');
  expect((await profileFor(request, headers, 103)).study_plan_hours).toMatchObject(hours);
  expect(writes).toHaveLength(5);

  // После подтверждённого content и ошибки плана возврат аттестации к исходному
  // значению — новая правка, а не повод восстановить уже сохранённое значение.
  const reversionBaseline = await profileFor(request, headers, 103);
  const initialControl = Number(reversionBaseline.content.__attestation__?.control ?? reversionBaseline.study_plan_hours.control);
  const attestation = contentTable(page).getByRole('row').filter({ hasText: 'Промежуточная аттестация:' });
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  const control = attestation.getByRole('cell').nth(6).getByRole('spinbutton');
  await expect(control).toHaveValue(String(initialControl));
  await control.fill(String(initialControl + 2));
  const reversionHours = { independent_work: reversionBaseline.study_plan_hours.independent_work + 1 };
  await planned.fill(String(reversionHours.independent_work));
  await failPlanOnce();
  const contentSaved = page.waitForResponse((response) => response.url().endsWith('/api/update-json-value/103') && response.ok());
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect((await contentSaved).request().postDataJSON().baseAt).toBe(reversionBaseline.field_edits.content.at);
  await expect(page.getByRole('alert').filter({ hasText: 'Содержание сохранено, часы учебного плана не сохранены.' })).toBeVisible();
  await expect(control).toHaveValue(String(initialControl + 2));
  const persisted = await profileFor(request, headers, 103);
  expect(persisted.content.__attestation__).toMatchObject({ ...reversionBaseline.content.__attestation__, control: initialControl + 2 });
  expect(preservedImportData(persisted)).toEqual(preservedImportData(reversionBaseline));
  expect(templateFromDb(103)).toMatchObject({ content: persisted.content, study_load: reversionBaseline.study_load });

  await control.fill(String(initialControl));
  const expectedReversion = { ...persisted.content, __attestation__: { ...persisted.content.__attestation__, control: initialControl } };
  const revertedContent = page.waitForResponse((response) => response.url().endsWith('/api/update-json-value/103') && response.ok());
  const retriedPlan = page.waitForResponse((response) => response.url().endsWith('/api/rpd-profile-templates/103/study-load') && response.ok());
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  const revertedResponse = await revertedContent;
  expect(revertedResponse.request().postDataJSON()).toEqual({ fieldToUpdate: 'content', value: expectedReversion, baseAt: persisted.field_edits.content.at });
  const receipt = await revertedResponse.json();
  expect(receipt.value).toEqual(expectedReversion);
  expect(receipt.edit).toMatchObject({ userId: 1, fullname: 'Руководов Т.Т.' });
  expect((await retriedPlan).request().postDataJSON()).toEqual({ hours: reversionHours });
  await expect(editActions(page).getByRole('button', { name: 'Редактировать' })).toBeVisible();
  expect(writes.slice(5).map((write) => write.url.split('/api/')[1])).toEqual([
    'update-json-value/103', 'rpd-profile-templates/103/study-load',
    'update-json-value/103', 'rpd-profile-templates/103/study-load',
  ]);
  const reverted = await profileFor(request, headers, 103);
  expect(reverted.content).toEqual(expectedReversion);
  expect(reverted.field_edits.content).toEqual(receipt.edit);
  expect(reverted.field_edits.content.at).not.toBe(persisted.field_edits.content.at);
  expect(reverted.study_plan_hours).toMatchObject(reversionHours);
  expect(templateFromDb(103)).toMatchObject({ content: expectedReversion, study_load: reverted.study_load,
    field_edits: { content: { userId: 1, at: receipt.edit.at } } });
  await page.reload();
  await expect(attestation.getByRole('cell').nth(6)).toHaveText(String(initialControl));
});

test('смена шаблона и аккаунта не переносит несохранённый черновик или поздний ответ отмены', async ({ page, request }) => {
  await signIn(page, 'teacher2');
  const headers = await headersFor(request, 'teacher2');
  const before = await profileFor(request, headers, 103);
  const other = await profileFor(request, headers, 104);
  await page.goto('/templates/cccccccccccc/disciplineContent');
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await contentTable(page).getByRole('textbox').first().fill('Черновик прежнего шаблона');
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() === 'PUT' && /\/api\/(update-json-value|rpd-profile-templates\/\d+\/study-load)/.test(request.url())) writes.push(request.url()); });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/rpd-profile-templates', async (route) => {
    if (route.request().postDataJSON().id === 103) {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  const cancellation = page.waitForRequest((request) => request.url().endsWith('/api/rpd-profile-templates') && request.postDataJSON()?.id === 103);
  await editActions(page).getByRole('button', { name: 'Отмена', exact: true }).click();
  await cancellation;
  try {
    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: 'Часы API для теста' }));
    await openContent(page);
    await expect(contentTable(page)).toBeVisible();
    await expect(contentTable(page).getByRole('textbox')).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
  await expect(contentTable(page)).toContainText(other.content['0'].theme);
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await editActions(page).getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(editActions(page).getByRole('button', { name: 'Редактировать' })).toBeVisible();
  expect(templateFromDb(104).content).toEqual(other.content);
  await page.goto('/templates/cccccccccccc/disciplineContent');
  await editActions(page).getByRole('button', { name: 'Редактировать' }).click();
  await contentTable(page).getByRole('textbox').first().fill('Черновик прежнего аккаунта');
  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  await page.getByRole('menuitem', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await signIn(page, 'rop');
  await page.goto('/templates/cccccccccccc/disciplineContent');
  await expect(contentTable(page)).toBeVisible();
  await expect(contentTable(page).getByRole('textbox')).toHaveCount(0);
  await expect(contentTable(page)).not.toContainText('Черновик прежнего аккаунта');
  expect(templateFromDb(103).content).toEqual(before.content);
  expect(writes).toEqual([]);
});
