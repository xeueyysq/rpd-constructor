import { expect, test } from '@playwright/test';
import { apiUrl, disciplines, openComplect, signIn } from '../helpers';
import { headersFor, list3, openFixtureComplect, preservedImportData, profileFor, templateFromDb } from '../list3';
import { closeTeachersDialog, openRowMenu } from '../teacherAssignments';

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
  expect(data.complects.map((entry: { id: number }) => entry.id)).not.toContain(list3.full.complectId);
  expect(data.complects.every((entry: { templates?: unknown }) => entry.templates === undefined)).toBe(true);
  const dialog = page.getByRole('dialog', { name: 'Импортировать данные РПД', exact: true });
  await expect(dialog).toContainText('Цель: Импорт поля List3 • семестр 4 • List3 Полный импорт • 2026');
  await dialog.getByRole('combobox', { name: 'Статус исходной дисциплины' }).click();
  await page.getByRole('option', { name: 'Создан', exact: true }).click();
  const search = dialog.getByRole('textbox', { name: 'Поиск по всем комплектам и дисциплинам' });
  await search.fill('мт'); // Буквы есть в «импорт», буквальной подстроки нет.
  await expect(dialog).toContainText('По выбранным условиям источников нет');
  await search.fill('импорт');
  const sourceCard = dialog.getByText(/Другое направление List3.*List3 Источники.*2026/).locator('..');
  await sourceCard.getByRole('button', { name: 'Показать дисциплины' }).click();
  const source = sourceCard.getByRole('button', { name: /Импорт поля list3.*семестр 1/i });
  const otherSemester = sourceCard.getByRole('button', { name: /Импорт поля list3.*семестр 2/i });
  await expect(source).toBeVisible();
  await expect(otherSemester).toHaveCount(0);
  await source.click();
  await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Подтвердите импорт', exact: true });
  await expect(confirmation).toContainText('Цель: Импорт поля List3 • семестр 4 • List3 Полный импорт • 2026');
  await expect(confirmation).toContainText(/Источник:.*Импорт\s+поля list3.*семестр 1.*2026/i);
  await expect(confirmation).toContainText('Содержательные поля РПД будут заменены. Компетенции и ФОС сохраняются.');
  await confirmation.screenshot({ path: testInfo.outputPath('full-import-target-context.png') });
  const copied = page.waitForResponse((response) => response.url() === `${apiUrl}/api/copy-template-content`
    && response.request().method() === 'POST');
  await confirmation.getByRole('button', { name: 'Импортировать', exact: true }).click();
  const response = await copied;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ sourceTemplateId: 300, targetTemplateId: 312 });
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

test('массовый импорт: точный семестр и тип, итог импортировано/пропущено, API/БД и reload', async ({ page, request }, testInfo) => {
  const headers = await headersFor(request);
  const before = await Promise.all([313, 314, 315].map((id) => profileFor(request, headers, id)));
  await signIn(page, 'rop');
  await openFixtureComplect(page, list3.bulk.complectId);
  await page.getByRole('button', { name: 'Импортировать все дисциплины', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать все дисциплины', exact: true });
  await expect(dialog).toContainText('Цель: Направление List3 • List3 Массовый импорт • 2026 • Очная');
  await expect(dialog.getByRole('button', { name: /List3 Массовый импорт/ })).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'Статус исходной дисциплины' }).click();
  await page.getByRole('option', { name: 'Создан', exact: true }).click();
  await dialog.getByText(/Другое направление List3.*List3 Источники.*2026/).locator('..')
    .getByRole('button', { name: 'Выбрать комплект' }).click();
  await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Подтвердите импорт', exact: true });
  await expect(confirmation).toContainText(/Источник:.*Институт источников List3.*Другое направление List3.*List3 Источники.*2026.*Бакалавриат/);
  const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/template-import/complect`
    && response.request().method() === 'POST');
  await confirmation.getByRole('button', { name: 'Импортировать', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON().sourceStatus).toBe('created');
  const result = await response.json();
  expect(result.counts).toEqual({ imported: 1, skipped: 2, total: 3 });
  expect(result.imported).toEqual([expect.objectContaining({ targetTemplateId: 313, sourceTemplateId: 300,
    semester: 1, record_type: 'discipline' })]);
  expect(result.skipped).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetTemplateId: 314, semester: 3, record_type: 'discipline', reason: 'missing_source' }),
    expect.objectContaining({ targetTemplateId: 315, semester: 2, record_type: 'practice', reason: 'missing_source' }),
  ]));
  await expect(dialog).toContainText('Импортировано: 1. Пропущено: 2. Всего: 3.');
  await expect(dialog).toContainText('семестр 3 • Дисциплина');
  await expect(dialog).toContainText('семестр 2 • Практика');
  await dialog.screenshot({ path: testInfo.outputPath('bulk-import-summary.png') });
  const after = await Promise.all([313, 314, 315].map((id) => profileFor(request, headers, id)));
  expect(after[0].goals).toBe('<p>Цели источника 300</p>');
  expect(after[0].content).toEqual({ 0: { theme: 'Тема источника', lectures: 9, seminars: 7, independent_work: 8, control: 0 } });
  after.forEach((profile, index) => expect(preservedImportData(profile)).toEqual(preservedImportData(before[index])));
  for (const index of [1, 2]) {
    expect(after[index].content).toEqual(before[index].content);
    expect(after[index].goals).toEqual(before[index].goals);
  }
  expect(templateFromDb(313)).toMatchObject({ goals: after[0].goals, content: after[0].content,
    ...preservedImportData(before[0]) });
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.goto(`/templates/${list3.bulk.publicId}/aimsPage`);
  await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
});
