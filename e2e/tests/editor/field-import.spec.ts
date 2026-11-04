import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiUrl, signIn } from '../helpers';
import { headersFor, list3, profileFor, templateFromDb } from '../list3';

async function fieldDialog(page: Page, button: Locator, mode: 'year' | 'direction', field: string) {
  await button.click();
  const preview = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/get-changeable-values' && url.searchParams.get('rowName') === field;
  });
  await page.getByRole('menuitem', { name: mode === 'year' ? /другого комплекта/ : /другого направления/ }).click();
  const dialog = page.getByRole('dialog', { name: mode === 'year'
    ? 'Загрузить из другого комплекта' : 'Загрузить из другого направления', exact: true });
  await expect(dialog).toBeVisible();
  const response = await preview;
  expect(response.status(), 'Предпросмотр через настоящий HTTP не должен возвращать 422/403').toBe(200);
  return { dialog, response };
}

async function copyField(page: Page, dialog: Locator, source: Locator, targetId: number, field: string, value: unknown) {
  await source.check();
  const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/copy-template-data`
    && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Загрузить', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ targetTemplateId: targetId, fieldToCopy: field });
  expect((await response.json()).value).toEqual(value);
  await expect(dialog).toBeHidden();
}

for (const role of ['rop', 'teacher'] as const) {
  test(`${role}: импорт поля из чужого черновика, разные годы/регистр, text[] литературы и reload`, async ({ page, request }) => {
    test.slow(); // Цели и два списка литературы проходят самостоятельный реальный import/reload.
    const target = role === 'rop' ? list3.fieldRop : list3.fieldTeacher;
    const headers = await headersFor(request, role);
    // Реальный wire-формат старого axios ids[] остаётся совместимым с Express.
    const bracketed = await request.get(`${apiUrl}/api/get-changeable-values`, { headers, params: {
      'ids[]': String(list3.oldSource.id), rowName: 'goals', targetTemplateId: target.id,
    } });
    expect(bracketed.status()).toBe(200);
    expect(await bracketed.json()).toEqual([expect.objectContaining({ id: 302, goals: '<p>Цели источника 302</p>' })]);
    await signIn(page, role);
    await page.goto(`/templates/${target.publicId}/aimsPage`);
    await expect(page.getByText('Прежние цели цели', { exact: true })).toBeVisible();
    const year = await fieldDialog(page, page.getByRole('button', { name: 'Импортировать поле', exact: true }), 'year', 'goals');
    const option = year.dialog.getByRole('radio', { name: /Импорт\s+поля list3.*2024/i });
    // Сырой ALLCAPS источника форматируется только для отображения;
    // сопоставление с названием цели в смешанном регистре остаётся рабочим.
    await expect(option).toBeVisible();
    await expect(year.dialog.getByRole('radio', { name: /2026/ })).toHaveCount(0);
    expect(new URL(year.response.url()).searchParams.getAll('ids')).toEqual(['302']);
    await option.locator('xpath=ancestor::label[1]').locator('..').getByRole('button').click();
    await expect(year.dialog.getByText('Цели источника 302', { exact: true })).toBeVisible();
    await copyField(page, year.dialog, option, target.id, 'goals', '<p>Цели источника 302</p>');
    await expect(page.getByText('Цели источника 302', { exact: true })).toBeVisible();

    // Тот же год разрешён через прежний пункт «другого направления».
    const direction = await fieldDialog(page, page.getByRole('button', { name: 'Импортировать поле', exact: true }), 'direction', 'goals');
    const sameYear = direction.dialog.getByRole('radio', { name: /Импорт\s+поля list3.*семестр 1.*Другое направление List3.*2026/i });
    await expect(sameYear).toBeVisible();
    await copyField(page, direction.dialog, sameYear, target.id, 'goals', '<p>Цели источника 300</p>');
    await page.reload();
    await expect(page.getByText('Цели источника 300', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ресурсное обеспечение', exact: true }).click();
    for (const [index, field, value] of [
      [0, 'textbook', ['Основная книга 302', 'Вторая основная книга 302']],
      [1, 'additional_textbook', ['Дополнительная книга 302']],
    ] as const) {
      const { dialog, response } = await fieldDialog(page,
        page.getByRole('button', { name: 'Импортировать поле', exact: true }).nth(index), 'year', field);
      expect(await response.json()).toEqual([expect.objectContaining({ id: 302, [field]: value })]);
      const radio = dialog.getByRole('radio', { name: /Импорт\s+поля list3.*2024/i });
      await radio.locator('xpath=ancestor::label[1]').locator('..').getByRole('button').click();
      for (const book of value) await expect(dialog.getByText(book, { exact: true })).toBeVisible();
      await copyField(page, dialog, radio, target.id, field, value);
      for (const book of value) await expect(page.getByText(book, { exact: true })).toBeVisible();
      await page.reload();
      for (const book of value) await expect(page.getByText(book, { exact: true })).toBeVisible();
    }
    const saved = await profileFor(request, headers, target.id);
    expect(saved).toMatchObject({ goals: '<p>Цели источника 300</p>',
      textbook: ['Основная книга 302', 'Вторая основная книга 302'], additional_textbook: ['Дополнительная книга 302'] });
    expect(templateFromDb(target.id)).toMatchObject({ goals: saved.goals, textbook: saved.textbook,
      additional_textbook: saved.additional_textbook });
  });
}
