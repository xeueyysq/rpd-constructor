import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiUrl, disciplines, openComplect, openTeacherRowMenu, showAllRows, signIn, signInWithCredentials, password } from '../helpers';
import { headersFor, list3, openFixtureComplect, preservedImportData, profileFor, templateFromDb } from '../list3';
import { closeTeachersDialog, openRowMenu } from '../teacherAssignments';

async function expectImportGeometry(page: Page, dialog: Locator) {
  const panel = await dialog.boundingBox();
  expect(panel).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(viewport.width);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(viewport.height - 64);
  expect(panel!.width).toBeLessThanOrEqual(1040);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const controls = await dialog.getByRole('combobox').all();
  for (const control of controls) {
    await expect(control).toBeVisible();
    await expect(control).toBeInViewport();
  }
  const filters = await Promise.all(controls.map((filter) => filter.boundingBox()));
  expect(filters).toHaveLength(4);
  for (const filter of filters) {
    expect(filter).not.toBeNull();
    expect(Math.abs(filter!.width - filters[0]!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(filter!.height - filters[0]!.height)).toBeLessThanOrEqual(1);
    expect(filter!.x).toBeGreaterThanOrEqual(panel!.x);
    expect(filter!.x + filter!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
  }
  if (viewport.width >= 600) {
    for (const filter of filters) expect(Math.abs(filter!.y - filters[0]!.y)).toBeLessThanOrEqual(1);
  } else {
    expect(Math.abs(filters[0]!.y - filters[1]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(filters[2]!.y - filters[3]!.y)).toBeLessThanOrEqual(1);
    expect(filters[2]!.y).toBeGreaterThanOrEqual(filters[0]!.y + filters[0]!.height);
    expect(Math.abs(filters[0]!.x - filters[2]!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(filters[1]!.x - filters[3]!.x)).toBeLessThanOrEqual(1);
  }
  const trigger = page.getByRole('button', { name: 'Сообщить о проблеме', exact: true });
  await expect(trigger).toHaveCount(1);
  const button = await trigger.boundingBox();
  expect(button!.x).toBeCloseTo(16, 0);
  expect(button!.y).toBeGreaterThanOrEqual(panel!.y + panel!.height);
  await expect(dialog.getByRole('button', { name: 'Продолжить', exact: true })).toBeInViewport();
}

test('полный импорт чужого черновика того же года: контекст, буквальный поиск, замена и reload', async ({ page, request }, testInfo) => {
  await signIn(page, 'rop');
  await openComplect(page);

  const target = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await openRowMenu(page, target);
  await page.getByRole('menuitem', { name: 'Изменить преподавателей' }).click();
  const teachers = page.getByRole('dialog', { name: `Преподаватели: ${disciplines.inProgress}`, exact: true });
  const fromOneC = teachers.getByRole('list', { name: 'Из 1С', exact: true });
  const others = teachers.getByRole('list', { name: 'Из системы', exact: true });
  await expect(fromOneC.getByRole('checkbox', { name: 'Альфина Тест Тестовна', exact: true })).toBeChecked();
  await expect(fromOneC.getByRole('checkbox')).toHaveCount(1);
  // Остальные аккаунты — во втором разделе, без пометки «из 1С» в подписи.
  await expect(others.getByRole('checkbox', { name: 'Яковлева Тест Тестовна', exact: true })).not.toBeChecked();
  await expect(others.getByRole('checkbox', { name: 'Альфина Тест Тестовна' })).toHaveCount(0);
  await expect(teachers.getByText('В 1С преподаватели не указаны')).toHaveCount(0);
  await closeTeachersDialog(teachers);
  const headers = await headersFor(request);
  const before = await profileFor(request, headers, list3.full.id);
  const admin = await headersFor(request, 'admin');
  const sourceData = await profileFor(request, admin, list3.source.id);
  const ordinaryRead = await request.post(`${apiUrl}/api/rpd-profile-templates`, {
    headers, data: { id: list3.source.id },
  });
  expect(ordinaryRead.status(), 'Каталог импорта не расширяет обычное чтение чужой РПД').toBe(403);
  await openFixtureComplect(page, list3.full.complectId);
  await openRowMenu(page, page.getByRole('row').filter({ hasText: list3.discipline }));
  const catalogResponse = page.waitForResponse((response) =>
    response.url().includes('/api/template-import/catalog') && response.request().method() === 'GET');
  await page.getByRole('menuitem', { name: 'Импортировать' }).click();
  const catalog = await catalogResponse;
  expect(catalog.status()).toBe(200);
  const data = await catalog.json();
  expect(data.scope).toBe('single');
  expect(data.complects).toEqual([]);
  expect(data.templates.every((entry: { complect: { id: number } }) => entry.complect.id !== list3.full.complectId)).toBe(true);
  const dialog = page.getByRole('dialog', { name: 'Импортировать данные РПД', exact: true });
  await expect(dialog).not.toContainText('Цель:');
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: 'Только готовые' })).toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Только готовые' }).uncheck();
  const search = dialog.getByRole('searchbox', { name: 'Поиск источников' });
  await search.fill('мт'); // Буквы есть в «импорт», буквальной подстроки нет.
  await expect(dialog).toContainText('По выбранным условиям источников нет');
  await search.fill('импорт');
  const source = dialog.getByRole('radio', { name: /Импорт поля list3.*семестр 1.*List3 Источники.*2026/i });
  const otherSemester = dialog.getByRole('radio', { name: /Импорт поля list3.*семестр 2.*List3 Источники.*2026/i });
  await expect(source).toBeVisible();
  await expect(otherSemester).toHaveCount(1);
  const sourceRow = source.locator('xpath=ancestor::tr');
  await sourceRow.getByRole('cell').nth(1).click();
  await expect(source).toBeChecked();
  await expect(otherSemester).not.toBeChecked();
  await expect(sourceRow).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Подтвердите импорт', exact: true });
  await expect(confirmation).not.toContainText('Цель:');
  await expect(confirmation).toContainText(/Источник:.*Импорт\s+поля list3.*семестр 1.*2026/i);
  await expect(confirmation.getByRole('radio', { name: 'Дополнить', exact: true })).toBeChecked();
  await confirmation.getByRole('radio', { name: 'Заменить', exact: true }).check();
  await expect(confirmation.getByRole('radio', { name: 'Заменить', exact: true })).toBeChecked();
  await expect(confirmation).toContainText('Содержательные поля РПД будут заменены, даже если поля источника пустые.');
  await expect(confirmation).toContainText('Компетенции и ФОС сохраняются.');
  await confirmation.screenshot({ path: testInfo.outputPath('full-import-target-context.png') });
  const copied = page.waitForResponse((response) => response.url() === `${apiUrl}/api/copy-template-content`
    && response.request().method() === 'POST');
  await confirmation.getByRole('button', { name: 'Импортировать', exact: true }).click();
  const response = await copied;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ sourceTemplateId: 300, targetTemplateId: 312, mode: 'replace' });
  expect(response.request().postDataJSON()).not.toHaveProperty('sourceStatus');
  expect(preservedImportData((await response.json()).targetTemplate)).toEqual(preservedImportData(before));
  await expect(dialog).toBeHidden();
  const after = await profileFor(request, headers, list3.full.id);
  expect(after.goals).toBe('<p>Цели источника 300</p>');
  expect(after.content).toEqual(sourceData.content);
  expect(after.textbook).toEqual(['Основная книга 300', 'Вторая основная книга 300']);
  expect(preservedImportData(after)).toEqual(preservedImportData(before));
  expect(templateFromDb(list3.full.id)).toMatchObject({ goals: after.goals, content: after.content,
    ...preservedImportData(before) });
  await page.goto(`/templates/${list3.full.publicId}/aimsPage`);
  await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Содержание дисциплины', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toContainText('Тема источника');
});

test('массовый импорт: точный семестр без кода, без повторного использования строки, API/БД и reload', async ({ page, request }, testInfo) => {
  test.slow();
  const headers = await headersFor(request);
  const before = await Promise.all([313, 314, 315].map((id) => profileFor(request, headers, id)));
  await signIn(page, 'rop');
  await openFixtureComplect(page, list3.bulk.complectId);
  await page.getByRole('button', { name: 'Импорт', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать все дисциплины', exact: true });
  await expect(dialog).not.toContainText('Цель:');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Показать дисциплины' })).toHaveCount(0);
  for (const width of [1365, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expectImportGeometry(page, dialog);
  }
  await page.setViewportSize({ width: 1365, height: 900 });
  await expect(dialog.getByRole('radio', { name: /List3 Массовый импорт/ })).toHaveCount(0);
  const catalogResponse = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('search') === 'List3 Источники');
  await dialog.getByRole('searchbox', { name: 'Поиск источников' }).fill('List3 Источники');
  expect(new URL((await catalogResponse).url()).searchParams.has('status')).toBe(false);
  const source = dialog.getByRole('radio', { name: /Другое направление List3.*List3 Источники.*2026/ });
  const sourceRow = source.locator('xpath=ancestor::tr');
  await sourceRow.getByRole('cell').nth(1).click();
  await expect(source).toBeChecked();
  await expect(sourceRow).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('combobox', { name: 'Год набора' }).selectOption('2024');
  await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
  await dialog.getByRole('combobox', { name: 'Год набора' }).selectOption('2026');
  await source.check();
  await dialog.screenshot({ path: testInfo.outputPath('bulk-import-selected.png') });
  await expect(dialog).toContainText('Другов Тест Тестович');
  await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Подтвердите импорт', exact: true });
  await expect(confirmation).toContainText(/Источник:.*Институт источников List3.*Другое направление List3.*List3 Источники.*2026.*Бакалавриат/);
  await expect(confirmation).toContainText('Сначала проверяются совпадения по названию и семестру.');
  await expect(confirmation).toContainText('единственные источник и цель');
  await expect(confirmation).toContainText('Неоднозначные совпадения пропускаются. Семестр учебного плана цели сохраняется.');
  await expect(confirmation.getByRole('radio', { name: 'Дополнить', exact: true })).toBeChecked();
  for (const [mode, label] of [['append', 'Дополнить'], ['replace', 'Заменить']] as const) {
    await confirmation.getByRole('radio', { name: label, exact: true }).check();
    for (const [width, height] of [[1365, 900], [390, 844], [320, 640]] as const) {
      await page.setViewportSize({ width, height });
      for (const control of await confirmation.getByRole('radio').all()) {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport({ ratio: 1 });
        await expect(control).toBeEnabled();
      }
      await expect(confirmation.getByRole('button', { name: 'Назад', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(confirmation.getByRole('button', { name: 'Импортировать', exact: true })).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await confirmation.screenshot({ path: testInfo.outputPath(`bulk-confirm-${mode}-${width}x${height}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 1365, height: 900 });
  }
  await expect(confirmation.getByRole('radio', { name: 'Заменить', exact: true })).toBeChecked();
  const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/template-import/complect`
    && response.request().method() === 'POST');
  await confirmation.getByRole('button', { name: 'Импортировать', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ sourceComplectId: 300,
    targetComplectId: list3.bulk.complectId, mode: 'replace' });
  expect(response.request().postDataJSON()).not.toHaveProperty('sourceStatus');
  const result = await response.json();
  expect(result.counts).toEqual({ imported: 2, skipped: 1, total: 3 });
  expect(result.imported).toHaveLength(2);
  expect(result.imported).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetTemplateId: 313, sourceTemplateId: 300, semester: 1, record_type: 'discipline' }),
    expect.objectContaining({ targetTemplateId: 315, sourceTemplateId: 301, semester: 2, record_type: 'practice' }),
  ]));
  expect(result.skipped).toEqual([
    expect.objectContaining({ targetTemplateId: 314, semester: 3, record_type: 'discipline', reason: 'missing_source' }),
  ]);
  await expect(dialog).toContainText('Импортировано: 2. Пропущено: 1. Всего: 3.');
  await expect(dialog).toContainText('Нет совпадающей дисциплины в источнике: 1');
  await dialog.screenshot({ path: testInfo.outputPath('bulk-import-summary.png') });
  const after = await Promise.all([313, 314, 315].map((id) => profileFor(request, headers, id)));
  expect(after[0].goals).toBe('<p>Цели источника 300</p>');
  expect(after[0].content).toEqual({ 0: { theme: 'Тема источника', lectures: 9, seminars: 7, independent_work: 8, control: 0 } });
  expect(after[2].goals).toBe('<p>Цели источника 301</p>');
  expect(after[2].content).toEqual({ 0: { theme: 'Тема источника', lectures: 9, seminars: 7, independent_work: 8, control: 0 } });
  expect(after[1].semester).toBe(3);
  after.forEach((profile, index) => expect(preservedImportData(profile)).toEqual(preservedImportData(before[index])));
  expect(after[1].content).toEqual(before[1].content);
  expect(after[1].goals).toEqual(before[1].goals);
  for (const index of [0, 2]) {
    for (const field of ['goals', 'content']) {
      expect(after[index].field_edits[field]).toMatchObject({ userId: 1, fullname: 'Руководов Т.Т.' });
      expect(Number.isNaN(Date.parse(after[index].field_edits[field].at))).toBe(false);
    }
    expect(templateFromDb(313 + index)).toMatchObject({ goals: after[index].goals, content: after[index].content,
      ...preservedImportData(before[index]), field_edits: {
        goals: { userId: 1, at: after[index].field_edits.goals.at },
        content: { userId: 1, at: after[index].field_edits.content.at },
      } });
  }
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.goto(`/templates/${list3.bulk.publicId}/aimsPage`);
  await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
  await page.goto('/templates/a315a315a315/aimsPage');
  await expect(page.getByText('Цели источника 301', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Цели источника 301', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Содержание дисциплины', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины', exact: true })).toContainText('Тема источника');
});

test('single РОП: плоская пагинация, год, только ready checkbox, сброс выбора; 1365/768/390', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1365, height: 900 });
  await signIn(page, 'rop');
  await openFixtureComplect(page, 400);
  await openRowMenu(page, page.getByRole('row').filter({ hasText: 'Длинное название дисциплины для проверки импорта UI' }));
  await page.getByRole('menuitem', { name: 'Импортировать', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать данные РПД', exact: true });
  const search = dialog.getByRole('searchbox', { name: 'Поиск источников' });
  const ready = dialog.getByRole('checkbox', { name: 'Только готовые', exact: true });
  await expect(ready).toBeChecked();
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Показать дисциплины' })).toHaveCount(0);
  await search.fill('UI');
  await expect(dialog.getByRole('radio')).toHaveCount(10);
  await expect(dialog.getByRole('table', { name: 'Дисциплины источников', exact: true })).toBeVisible();
  const countVisibleRows = () => dialog.getByRole('radio').evaluateAll((radios) => radios.filter((radio) => {
    const row = radio.closest('tr')!.getBoundingClientRect();
    const area = radio.closest('.MuiTableContainer-root')!.getBoundingClientRect();
    return row.top >= area.top && row.bottom <= area.bottom;
  }).length);
  await expect.poll(countVisibleRows).toBeGreaterThanOrEqual(6);
  for (const width of [1365, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await expectImportGeometry(page, dialog);
    await dialog.screenshot({ path: test.info().outputPath('single-' + width + '.png') });
  }
  await page.setViewportSize({ width: 1365, height: 900 });
  const firstSource = dialog.getByRole('radio').first();
  const firstRow = firstSource.locator('xpath=ancestor::tr');
  await firstRow.getByRole('cell').nth(1).click();
  await expect(firstSource).toBeChecked();
  await expect(firstRow).toHaveAttribute('aria-selected', 'true');
  await dialog.screenshot({ path: test.info().outputPath('single-selected.png') });
  const secondSource = dialog.getByRole('radio').nth(1);
  const secondRow = secondSource.locator('xpath=ancestor::tr');
  await secondRow.focus();
  await page.keyboard.press('Space');
  await expect(secondSource).toBeChecked();
  await expect(firstSource).not.toBeChecked();
  await firstRow.focus();
  await page.keyboard.press('Enter');
  await expect(firstSource).toBeChecked();
  await expect(secondSource).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeEnabled();
  const nextPage = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('page') === '2');
  await dialog.getByRole('button', { name: 'Следующая страница' }).click();
  const nextCatalog = await nextPage;
  expect(nextCatalog.status()).toBe(200);
  expect(new URL(nextCatalog.url()).searchParams.get('pageSize')).toBe('10');
  await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
  const yearPage = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('year') === '2024');
  await dialog.getByRole('combobox', { name: 'Год набора' }).selectOption('2024');
  const yearCatalog = await yearPage;
  expect(new URL(yearCatalog.url()).searchParams.get('page')).toBe('1');
  expect((await yearCatalog.json()).total).toBe(6);
  await expect(dialog.getByRole('radio')).toHaveCount(6);
  await dialog.getByRole('combobox', { name: 'Год набора' }).selectOption('');
  await dialog.getByRole('combobox', { name: 'Факультет / институт' }).selectOption('Институт UI источников');
  await expect(dialog.getByRole('radio')).toHaveCount(10);
  await dialog.getByRole('radio').first().locator('xpath=ancestor::tr').getByRole('cell').nth(1).click();
  await search.fill('нет такого источника UI');
  await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
  expect(await dialog.getByRole('radio').count()).toBe(0); // До завершения debounce старый список уже закрыт.
  await expect(dialog).toContainText('По выбранным условиям источников нет');
  await search.fill('UI');
  const allResponse = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('scope') === 'single'
    && !new URL(response.url()).searchParams.has('status'));
  await ready.uncheck();
  const catalog = await allResponse;
  expect(new URL(catalog.url()).searchParams.get('ownOnly')).toBe('false');
  const rows = (await catalog.json()).templates as Array<{ id: number }>;
  expect(rows.map((row) => row.id)).toContain(4011); // Источник не назначен преподавателю.
  await expect(dialog.getByRole('radio', { name: /Назначены преподаватели|Создан/ }).first()).toBeVisible();
  await dialog.getByRole('radio').first().check();
  const readyResponse = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('status') === 'ready');
  await ready.check();
  expect((await readyResponse).status()).toBe(200);
  await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
  await dialog.getByRole('radio').first().check();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Подтвердите импорт' });
  await confirmation.getByRole('radio', { name: 'Заменить', exact: true }).check();
  await expect(confirmation.getByRole('radio', { name: 'Заменить', exact: true })).toBeChecked();
  await page.route('**/api/copy-template-content', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const copied = page.waitForRequest((request) => request.url().endsWith('/api/copy-template-content'));
  await page.getByRole('dialog', { name: 'Подтвердите импорт' }).getByRole('button', { name: 'Импортировать', exact: true }).click();
  expect((await copied).postDataJSON()).toMatchObject({ targetTemplateId: 4000, sourceStatus: 'ready', mode: 'replace' });
  await expect(dialog).toContainText('Не удалось выполнить действие');
  await dialog.getByRole('button', { name: 'Импортировать из Word', exact: true }).click();
  const word = page.getByRole('dialog', { name: 'Импортировать из Word', exact: true });
  await expect(word).not.toContainText('Цель:');
  await word.getByRole('button', { name: 'Выбрать РПД из комплекта', exact: true }).click();
  await expect(dialog.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
});

test('single teacher: только назначенные источники всех названий, год и ownOnly при применении', async ({ page }) => {
  await signIn(page, 'teacher');
  await showAllRows(page);
  await openTeacherRowMenu(page, page.getByRole('row').filter({ hasText: 'Длинное название дисциплины для проверки импорта UI' }).filter({ hasText: 'UI цель' }).filter({ hasText: '2026' }));
  await page.getByRole('menuitem', { name: 'Импортировать', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать данные РПД', exact: true });
  await expect(dialog.getByRole('combobox')).toHaveCount(4);
  await expect(dialog.getByRole('tab')).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: 'Только готовые' })).toBeChecked();
  const loaded = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('search') === 'UI');
  await dialog.getByRole('searchbox', { name: 'Поиск источников' }).fill('UI');
  const response = await loaded;
  expect(new URL(response.url()).searchParams.get('ownOnly')).toBe('true');
  expect((await response.json()).templates.map((row: { id: number }) => row.id)).toEqual([4010, 4020, 4030]);
  await expect(dialog.getByRole('radio')).toHaveCount(3);
  await dialog.getByRole('combobox', { name: 'Год набора' }).selectOption('2026');
  await expect(dialog.getByRole('radio')).toHaveCount(2);
  await dialog.getByRole('radio', { name: /Другая дисциплина UI/ }).check();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Подтвердите импорт' });
  await page.route('**/api/copy-template-content', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  const applying = page.waitForRequest((request) => request.url().endsWith('/api/copy-template-content'));
  await confirmation.getByRole('button', { name: 'Импортировать', exact: true }).click();
  expect((await applying).postDataJSON()).toMatchObject({ sourceTemplateId: 4030, targetTemplateId: 4000, ownOnly: true });
  await expect(dialog).toContainText('Не удалось выполнить действие');
});

test('учительское представление РОП передаёт ownOnly в field и single и скрывает вкладки', async ({ page }) => {
  await signInWithCredentials(page, 'owner-third-rop', password);
  await expect(page).toHaveURL(/\/complects$/);
  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  await page.getByRole('menuitem', { name: 'Преподаватель', exact: true }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await openTeacherRowMenu(page, page.getByRole('row').filter({ hasText: 'Множественные РОП для теста' }));
  const singleResponse = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('scope') === 'single');
  await page.getByRole('menuitem', { name: 'Импортировать', exact: true }).click();
  const single = page.getByRole('dialog', { name: 'Импортировать данные РПД', exact: true });
  expect(new URL((await singleResponse).url()).searchParams.get('ownOnly')).toBe('true');
  await expect(single.getByRole('combobox')).toHaveCount(4);
  await expect(single.getByRole('tab')).toHaveCount(0);
  await single.getByRole('button', { name: 'Отмена' }).click();
  await page.goto('/templates/a350a350a350/aimsPage');
  const fieldResponse = page.waitForResponse((response) => response.url().includes('/api/template-import/catalog')
    && new URL(response.url()).searchParams.get('scope') === 'field');
  await page.getByRole('button', { name: 'Импортировать поле', exact: true }).click();
  const field = page.getByRole('dialog', { name: 'Импортировать: Цели и задачи', exact: true });
  const catalog = await fieldResponse;
  expect(new URL(catalog.url()).searchParams.get('ownOnly')).toBe('true');
  expect(new URL(catalog.url()).searchParams.has('sourceMode')).toBe(false);
  await expect(field.getByRole('combobox')).toHaveCount(4);
  await expect(field.getByRole('tab')).toHaveCount(0);
  await expect(field.getByRole('tabpanel')).toHaveCount(0);
  await expect(field.getByRole('checkbox')).toHaveCount(0);
  await expect(field.getByRole('radio')).toHaveCount(0);
});

test('admin: год — четвёртый селектор single/field/bulk, прежние вкладки field сохранены', async ({ page }) => {
  await signIn(page, 'admin');
  await openFixtureComplect(page, 400);
  await openRowMenu(page, page.getByRole('row').filter({ hasText: 'Длинное название дисциплины для проверки импорта UI' }));
  await page.getByRole('menuitem', { name: 'Импортировать', exact: true }).click();
  const single = page.getByRole('dialog', { name: 'Импортировать данные РПД', exact: true });
  await expect(single.getByRole('combobox')).toHaveCount(4);
  await expect(single.getByRole('combobox', { name: 'Год набора' })).toHaveValue('');
  await expect(single.getByRole('checkbox', { name: 'Только готовые' })).toBeChecked();
  await single.getByRole('button', { name: 'Отмена' }).click();
  await page.getByRole('button', { name: 'Импорт', exact: true }).click();
  const bulk = page.getByRole('dialog', { name: 'Импортировать все дисциплины', exact: true });
  await expect(bulk.getByRole('combobox')).toHaveCount(4);
  await expect(bulk.getByRole('combobox', { name: 'Год набора' })).toHaveValue('');
  await expect(bulk.getByRole('checkbox')).toHaveCount(0);
  await bulk.getByRole('button', { name: 'Отмена' }).click();
  await page.goto('/templates/d400d400d400/aimsPage');
  await page.getByRole('button', { name: 'Импортировать поле', exact: true }).click();
  const field = page.getByRole('dialog', { name: 'Импортировать: Цели и задачи', exact: true });
  await expect(field.getByRole('combobox')).toHaveCount(4);
  await expect(field.getByRole('combobox', { name: 'Год набора' })).toHaveValue('');
  await expect(field.getByRole('checkbox')).toHaveCount(0);
  await expect(field.getByRole('tab', { name: 'Другой комплект' })).toHaveAttribute('aria-selected', 'true');
  await field.getByRole('tab', { name: 'Другой год' }).click();
  const panel = field.getByRole('tabpanel');
  await expect(panel).toHaveAttribute('aria-labelledby', (await field.getByRole('tab', { name: 'Другой год' }).getAttribute('id'))!);
});
