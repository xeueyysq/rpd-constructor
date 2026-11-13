import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiUrl, password, signIn, signInWithCredentials } from '../helpers';
import { headersFor, list3, profileFor, templateFromDb } from '../list3';

async function chooseFieldSource(page: Page, button: Locator, mode: 'other-year' | 'other-complect', field: string) {
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать поле', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Статус исходной дисциплины' }).click();
  await page.getByRole('option', { name: 'Все статусы' }).click();
  if (mode === 'other-year') await dialog.getByRole('button', { name: 'Из другого года' }).click();
  await dialog.getByRole('button', { name: 'Показать дисциплины' }).first().click();
  const preview = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/get-changeable-values' && url.searchParams.get('rowName') === field;
  });
  await dialog.getByRole('button', { name: /семестр 1.*Дисциплина/i }).first().click();
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
  const first = page.getByRole('dialog', { name: 'Импортировать поле', exact: true });
  await first.getByRole('combobox', { name: 'Статус исходной дисциплины' }).click();
  await page.getByRole('option', { name: 'Все статусы' }).click();
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
    expect(await year.response.json()).toEqual([expect.objectContaining({ id: 302, goals: '<p>Цели источника 302</p>' })]);
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
      expect(await chosen.response.json()).toEqual([expect.objectContaining({ id: 302, [field]: value })]);
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
