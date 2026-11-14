import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiUrl, password, signIn, signInWithCredentials } from '../helpers';
import { headersFor, list3, profileFor, templateFromDb } from '../list3';

async function chooseFieldSource(page: Page, button: Locator, mode: 'other-year' | 'other-complect', field: string) {
  await button.click();
  const names: Record<string, string> = { goals: 'Цели и задачи', textbook: 'Основная литература',
    additional_textbook: 'Дополнительная литература', content: 'Содержание дисциплины' };
  const dialog = page.getByRole('dialog', { name: `Импортировать: ${names[field]}`, exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox')).toHaveCount(3);
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  if (mode === 'other-year') await dialog.getByRole('tab', { name: 'Другой год' }).click();
  await dialog.getByRole('radio', { name: /семестр 1.*Дисциплина/i }).first().check();
  const preview = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/get-changeable-values' && url.searchParams.get('rowName') === field;
  });
  await dialog.getByRole('button', { name: /^Просмотр:/ }).first().click();
  const response = await preview;
  expect(response.status()).toBe(200);
  return { dialog, response };
}

async function applyField(page: Page, dialog: Locator, targetId: number, field: string, value: unknown) {
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Подтвердите импорт' });
  await expect(confirmation).toContainText('Выбранное поле будет заменено');
  const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/copy-template-data`
    && response.request().method() === 'POST');
  await confirmation.getByRole('button', { name: 'Импортировать' }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ targetTemplateId: targetId, fieldToCopy: field });
  expect((await response.json()).value).toEqual(value);
  await expect(dialog).toBeHidden();
  return response;
}

test('повторное открытие импорта поля видит источник, добавленный после первого просмотра', async ({ page, request }, testInfo) => {
  test.slow();
  const target = list3.fieldReopen;
  const headers = await headersFor(request, target.owner);
  const before = await profileFor(request, headers, target.id);
  await signInWithCredentials(page, target.owner, password);
  await expect(page).toHaveURL(/\/complects$/);
  await page.goto(`/templates/${target.publicId}/aimsPage`);
  const button = page.getByRole('button', { name: 'Импортировать поле', exact: true });
  await button.click();
  const first = page.getByRole('dialog', { name: 'Импортировать: Цели и задачи', exact: true });
  await expect(first).toContainText('По выбранным условиям источников нет');
  await first.getByRole('button', { name: 'Отмена' }).click();

  const added = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers, data: {
    complectId: target.sourceComplectId,
    selections: [{ action: 'add', incoming: {
      discipline: target.discipline, semester: 1, record_type: 'discipline',
      department: 'Кафедра каталога List3', teachers: [], zet: 3, place: 'Базовая часть',
      study_load: { 'Всего': 108 }, control_load: {},
    } }],
  } });
  expect(added.status()).toBe(200);
  const sourceComplect = await request.post(`${apiUrl}/api/find-rpd`, {
    headers, data: { complectId: target.sourceComplectId },
  });
  expect(sourceComplect.status()).toBe(200);
  const { templates } = await sourceComplect.json();
  expect(templates).toHaveLength(1);
  const sourceId = templates[0].id_profile_template as number;
  const source = await profileFor(request, headers, sourceId);
  const value = '<p>Цели нового источника после открытия</p>';
  const filled = await request.put(`${apiUrl}/api/update-json-value/${sourceId}`, { headers, data: {
    fieldToUpdate: 'goals', value, baseAt: source.field_edits?.goals?.at ?? null,
  } });
  expect(filled.status()).toBe(200);

  const chosen = await chooseFieldSource(page, button, 'other-year', 'goals');
  expect(await chosen.response.json()).toEqual([expect.objectContaining({ id: sourceId, goals: value })]);
  await expect(chosen.dialog).toContainText('Цели нового источника после открытия');
  await chosen.dialog.screenshot({ path: testInfo.outputPath('field-import-refreshed.png') });
  const copied = await applyField(page, chosen.dialog, target.id, 'goals', value);
  expect(copied.request().postDataJSON().baseAt).toBe(before.field_edits.goals.at);
  const saved = await profileFor(request, headers, target.id);
  expect(saved.goals).toBe(value);
  expect(saved.field_edits.goals.userId).toBe(30);
  expect(saved.field_edits.goals.at).not.toBe(before.field_edits.goals.at);
  expect(Number.isNaN(Date.parse(saved.field_edits.goals.at))).toBe(false);
  expect(templateFromDb(target.id)).toMatchObject({ goals: value,
    field_edits: { goals: { userId: 30, at: saved.field_edits.goals.at } } });
  await page.reload();
  await expect(page.getByText('Цели нового источника после открытия', { exact: true })).toBeVisible();
});

for (const role of ['rop', 'teacher'] as const) {
  test(`${role}: импорт поля из другого года и комплекта, включая литературу`, async ({ page, request }) => {
    test.slow();
    const target = role === 'rop' ? list3.fieldRop : list3.fieldTeacher;
    const headers = await headersFor(request, role);
    await signIn(page, role);
    await page.goto(`/templates/${target.publicId}/aimsPage`);
    const button = page.getByRole('button', { name: 'Импортировать поле', exact: true });
    const year = await chooseFieldSource(page, button, 'other-year', 'goals');
    const yearSourceId = role === 'rop' ? 303 : 304;
    expect(await year.response.json()).toEqual([expect.objectContaining({ id: yearSourceId, goals: '<p>Цели источника 302</p>' })]);
    await applyField(page, year.dialog, target.id, 'goals', '<p>Цели источника 302</p>');
    const sameYear = await chooseFieldSource(page, button, 'other-complect', 'goals');
    expect(await sameYear.response.json()).toEqual([expect.objectContaining({ id: 300, goals: '<p>Цели источника 300</p>' })]);
    await applyField(page, sameYear.dialog, target.id, 'goals', '<p>Цели источника 300</p>');
    await page.getByRole('button', { name: 'Ресурсное обеспечение', exact: true }).click();
    for (const [index, field, value] of [
      [0, 'textbook', ['Основная книга 302', 'Вторая основная книга 302']],
      [1, 'additional_textbook', ['Дополнительная книга 302']],
    ] as const) {
      const chosen = await chooseFieldSource(page,
        page.getByRole('button', { name: 'Импортировать поле', exact: true }).nth(index), 'other-year', field);
      expect(await chosen.response.json()).toEqual([expect.objectContaining({ id: yearSourceId, [field]: value })]);
      await applyField(page, chosen.dialog, target.id, field, value);
      for (const book of value) await expect(page.getByText(book, { exact: true })).toBeVisible();
    }
    const saved = await profileFor(request, headers, target.id);
    expect(saved).toMatchObject({ goals: '<p>Цели источника 300</p>',
      textbook: ['Основная книга 302', 'Вторая основная книга 302'],
      additional_textbook: ['Дополнительная книга 302'] });
    const actorId = role === 'rop' ? 1 : 2;
    for (const field of ['goals', 'textbook', 'additional_textbook'] as const) {
      expect(saved.field_edits[field].userId).toBe(actorId);
      expect(Number.isNaN(Date.parse(saved.field_edits[field].at))).toBe(false);
    }
    expect(templateFromDb(target.id)).toMatchObject({ goals: saved.goals, textbook: saved.textbook,
      additional_textbook: saved.additional_textbook,
      field_edits: {
        goals: { userId: actorId, at: saved.field_edits.goals.at },
        textbook: { userId: actorId, at: saved.field_edits.textbook.at },
        additional_textbook: { userId: actorId, at: saved.field_edits.additional_textbook.at },
      } });
    await page.reload();
    await expect(page.getByText('Основная книга 302', { exact: true })).toBeVisible();
    await expect(page.getByText('Вторая основная книга 302', { exact: true })).toBeVisible();
    await expect(page.getByText('Дополнительная книга 302', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Цели и задачи освоения дисциплины', exact: true }).click();
    await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
  });
}

test('field: полные текст, литература и темы/часы; просмотр не выбирает источник, оба режима ограничены назначением и названием', async ({ page }) => {
  test.slow();
  await signIn(page, 'teacher');
  await page.goto('/templates/d400d400d400/aimsPage');
  for (const [section, index, title, kind] of [
    ['Цели и задачи освоения дисциплины', 0, 'Цели и задачи', 'text'],
    ['Ресурсное обеспечение', 0, 'Основная литература', 'books'],
    ['Содержание дисциплины', 0, 'Содержание дисциплины', 'content'],
    ['Ресурсное обеспечение', 3, 'Программное обеспечение', 'empty'],
  ] as const) {
    await page.getByRole('button', { name: section, exact: true }).click();
    await page.getByRole('button', { name: 'Импортировать поле', exact: true }).nth(index).click();
    const dialog = page.getByRole('dialog', { name: `Импортировать: ${title}`, exact: true });
    await expect(dialog.getByRole('radio')).toHaveCount(2); // 4010 и 4020; чужие назначения, имя и уровень исключены.
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await expect(dialog.getByRole('combobox')).toHaveCount(3);
    await expect(dialog.getByRole('button', { name: 'Импортировать из Word' })).toHaveCount(0);
    await expect(dialog).not.toContainText('Цель:');
    if (kind === 'text') {
      const year = dialog.getByRole('tab', { name: 'Другой год' });
      const complect = dialog.getByRole('tab', { name: 'Другой комплект' });
      await complect.focus();
      await page.keyboard.press('ArrowRight');
      await expect(year).toBeFocused();
      await page.keyboard.press('Space');
      await expect(year).toHaveAttribute('aria-selected', 'true');
      await expect(dialog.getByRole('radio')).toHaveCount(1);
      await page.keyboard.press('Home');
      await expect(complect).toBeFocused();
      await page.keyboard.press('Space');
      await expect(dialog.getByRole('radio')).toHaveCount(2);
    }
    const eye = dialog.getByRole('button', { name: /^Просмотр:/ }).first();
    const loaded = page.waitForResponse((response) => response.url().includes('/api/get-changeable-values') && response.status() === 200);
    await eye.click();
    await loaded;
    const preview = dialog.getByRole('region', { name: `Предпросмотр: ${title}`, exact: true });
    await expect(preview).toBeFocused();
    await expect(eye).toHaveAttribute('aria-expanded', 'true');
    await expect(preview.locator('xpath=ancestor::div[contains(@class,"MuiCollapse-root")]')).toHaveClass(/MuiCollapse-entered/);
    await expect(preview.getByRole('button', { name: 'Закрыть предпросмотр' })).toHaveCount(0);
    await expect(preview).not.toContainText('Поле пустое');
    await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
    if (kind === 'text') {
      await expect(preview).toContainText('Последний абзац 4010');
      await expect(preview).toContainText('Последний пункт');
      await expect(preview).toContainText('Вторая ячейка');
      expect(await preview.textContent()).not.toContain('window.__importPreviewExecuted');
      expect(await page.evaluate(() => '__importPreviewExecuted' in window)).toBe(false);
      await expect(preview.locator('script')).toHaveCount(0);
    } else if (kind === 'books') {
      await expect(preview.getByRole('listitem')).toHaveCount(2);
      await expect(preview).toContainText('Конец первой книги 4010');
      await expect(preview).toContainText('Последняя книга 4010');
    } else if (kind === 'content') {
      const table = preview.getByRole('table', { name: 'Темы и часы' });
      await expect(table.getByRole('row')).toHaveCount(9);
      await expect(table).toContainText('Тема 8 источника 4010');
      await expect(table.getByRole('columnheader', { name: 'Самостоятельная работа', exact: true })).toBeVisible();
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 640 });
        const scroller = preview.getByRole('region', { name: /горизонтальная прокрутка/ });
        expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
        await scroller.focus();
        await page.keyboard.press('End');
        await expect.poll(() => scroller.evaluate((element) => {
          const last = element.querySelector('tbody tr:last-child td:last-child')!;
          const cell = last.getBoundingClientRect();
          const region = element.getBoundingClientRect();
          return cell.left >= region.left && cell.right <= region.right + 1 && element.scrollLeft > 0;
        })).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(dialog.getByRole('button', { name: 'Продолжить', exact: true })).toBeInViewport();
        await dialog.screenshot({ path: test.info().outputPath(`field-full-table-${width}.png`) });
      }
    } else {
      await expect(preview).toHaveText('');
    }
    await eye.click();
    await expect(eye).toHaveAttribute('aria-expanded', 'false');
    await expect(preview).toHaveCount(0);
    await expect(eye).toBeFocused();
    await dialog.getByRole('radio').first().check();
    await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeEnabled();
    await dialog.getByRole('tab', { name: 'Другой год' }).click();
    await expect(dialog.getByRole('radio')).toHaveCount(1);
    await expect(dialog.getByRole('radio')).not.toBeChecked();
    await expect(dialog.getByRole('radio')).toHaveAccessibleName(/UI цель.*2024/);
    await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    await page.setViewportSize({ width: 1365, height: 900 });
  }
});

test('field: задержанный preview предыдущей строки не подменяет просмотр нового источника', async ({ page }) => {
  await signIn(page, 'teacher');
  await page.goto('/templates/d400d400d400/aimsPage');
  await page.getByRole('button', { name: 'Импортировать поле', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать: Цели и задачи', exact: true });
  await expect(dialog.getByRole('radio')).toHaveCount(2);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let finishDelayed!: () => void;
  const delayedDone = new Promise<void>((resolve) => { finishDelayed = resolve; });
  await page.route('**/api/get-changeable-values?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('ids') !== '4010') return route.continue();
    const response = await route.fetch();
    await gate;
    try {
      await route.fulfill({ response });
    } catch (error) {
      if (!route.request().failure()) throw error;
    } finally { finishDelayed(); }
  });
  const started = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/get-changeable-values'
    && new URL(request.url()).searchParams.get('ids') === '4010');
  await dialog.getByRole('button', { name: /^Просмотр:/ }).first().click();
  await started;
  try {
    await dialog.getByRole('button', { name: /^Просмотр:/ }).nth(1).click();
    const preview = dialog.getByRole('region', { name: 'Предпросмотр: Цели и задачи', exact: true });
    await expect(preview).toContainText('Последний абзац 4020');
    release();
    await delayedDone;
    await expect(preview).not.toContainText('Последний абзац 4010');
    await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
  } finally { release(); }
});

test('импорт content обновляет открытую таблицу без reload, сохраняет автора и часы в БД', async ({ page, request }) => {
  const headers = await headersFor(request);
  const before = await profileFor(request, headers, list3.fieldRop.id);
  await signIn(page, 'rop');
  await page.goto(`/templates/${list3.fieldRop.publicId}/disciplineContent`);
  const chosen = await chooseFieldSource(page, page.getByRole('button', { name: 'Импортировать поле', exact: true }).first(), 'other-complect', 'content');
  const value = { 0: { theme: 'Тема источника', lectures: 9, seminars: 7, independent_work: 8, control: 0 } };
  const response = await applyField(page, chosen.dialog, list3.fieldRop.id, 'content', value);
  expect(response.request().postDataJSON().baseAt).toBe(before.field_edits?.content?.at ?? null);
  await expect(page.getByRole('table', { name: 'Содержание дисциплины', exact: true }).getByRole('textbox').first()).toHaveValue('Тема источника');
  const saved = await profileFor(request, headers, list3.fieldRop.id);
  expect(saved.content).toEqual(value);
  expect(saved.field_edits.content.userId).toBe(1);
  expect(Number.isNaN(Date.parse(saved.field_edits.content.at))).toBe(false);
  expect(templateFromDb(list3.fieldRop.id)).toMatchObject({ content: value, field_edits: { content: { userId: 1, at: saved.field_edits.content.at } } });
  await page.reload();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины', exact: true }).getByRole('textbox').first()).toHaveValue('Тема источника');
});
