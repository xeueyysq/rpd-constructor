import { expect, test } from '@playwright/test';
import { apiUrl, password, signInWithCredentials } from '../helpers';
import { headersFor, syncFixtures, syncStateFromDb } from '../list3';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

test('sync: поздний preview A не попадает в B, поздний Apply не закрывает новое открытие B', async ({ page, request }, testInfo) => {
  const a = syncFixtures.dialogA;
  const b = syncFixtures.dialogB;
  const headers = await headersFor(request, syncFixtures.dialogOwner);
  const beforeA = syncStateFromDb([a.id]);
  const incomingA = {
    discipline: 'Поздняя дисциплина плана A', department: 'Кафедра sync A',
    semester: 1, record_type: 'discipline', teachers: [], zet: 3, place: 'Базовая часть',
    study_load: { 'Всего': 108 }, control_load: {},
  };
  const incomingB = {
    discipline: 'Выбранная дисциплина плана B', department: 'Кафедра sync B',
    semester: 2, record_type: 'discipline', teachers: [], zet: 2, place: 'Вариативная часть',
    study_load: { 'Всего': 72 }, control_load: {},
  };
  const nextIncomingB = { ...incomingB, discipline: 'Дисциплина нового открытия B' };
  const previewStarted = gate();
  const releasePreview = gate();
  const appliedOnServer = gate();
  const releaseApply = gate();
  let bLoads = 0;
  let applyStatus: number | undefined;

  // Недоступный внешний producer 1С даёт фиксированный план. UI-обработчики,
  // sync/apply, авторизация и сохранение в PostgreSQL остаются настоящими.
  await page.route(`${apiUrl}/api/complects/sync/preview`, async (route) => {
    const id = route.request().postDataJSON().complectId as string;
    const target = id === a.uuid ? a : b;
    expect([a.uuid, b.uuid]).toContain(id);
    const incoming = id === a.uuid ? incomingA : ++bLoads === 1 ? incomingB : nextIncomingB;
    if (id === a.uuid) {
      previewStarted.release();
      await releasePreview.promise;
    }
    await route.fulfill({ json: {
      complect: { id: target.id, uuid: target.uuid },
      diff: {
        new: [{ key: `${incoming.discipline}|${incoming.semester}|discipline`, incoming,
          fields: [{ field: 'discipline', old: null, new: incoming.discipline }] }],
        updated: [], removed: [], unchanged: [],
      },
    } });
  });
  await page.route(`${apiUrl}/api/complects/sync/apply`, async (route) => {
    // Задерживаем только доставку настоящего ответа уже завершённой транзакции.
    const response = await route.fetch();
    applyStatus = response.status();
    appliedOnServer.release();
    await releaseApply.promise;
    await route.fulfill({ response });
  });

  try {
    await signInWithCredentials(page, syncFixtures.dialogOwner, password);
    await expect(page).toHaveURL(/\/complects$/);
    const rowA = page.getByRole('row').filter({ has: page.getByRole('cell', { name: a.profile, exact: true }) });
    const rowB = page.getByRole('row').filter({ has: page.getByRole('cell', { name: b.profile, exact: true }) });
    const update = page.getByRole('button', { name: 'Обновить комплект', exact: true });
    const dialog = page.getByRole('dialog', { name: 'Обновление комплекта из 1С', exact: true });
    const load = dialog.getByRole('button', { name: 'Загрузить из 1С', exact: true });
    const apply = dialog.getByRole('button', { name: 'Применить выбранное', exact: true });

    await rowA.getByRole('checkbox').check();
    await update.click();
    const latePreview = page.waitForResponse((response) => response.url() === `${apiUrl}/api/complects/sync/preview`
      && response.request().postDataJSON().complectId === a.uuid);
    await load.click();
    await previewStarted.promise;
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
    await expect(dialog).toBeHidden();
    await rowA.getByRole('checkbox').uncheck();
    await rowB.getByRole('checkbox').check();
    await update.click();
    await expect(apply).toBeDisabled();
    releasePreview.release();
    const previewResponse = await latePreview;
    expect(previewResponse.status()).toBe(200);
    await previewResponse.finished();
    await expect(load).toBeEnabled();
    await expect(dialog.getByText(incomingA.discipline, { exact: true }),
      'Поздний ответ закрытого открытия A не должен появляться в B').toHaveCount(0);
    await expect(apply, 'Diff A нельзя применить к текущей цели B').toBeDisabled();
    await load.click();
    const selectedB = dialog.getByRole('checkbox', { name: new RegExp(incomingB.discipline) });
    await expect(selectedB).toBeChecked();
    await selectedB.uncheck();
    await expect(apply).toBeDisabled();

    await selectedB.check();
    await dialog.screenshot({ path: testInfo.outputPath('sync-preview-bound-to-b.png') });

    const applyRequest = page.waitForRequest(`${apiUrl}/api/complects/sync/apply`);
    await apply.click();
    await page.getByRole('dialog', { name: 'Подтвердите обновление', exact: true })
      .getByRole('button', { name: 'Применить', exact: true }).click();
    const sent = (await applyRequest).postDataJSON();
    expect(sent.complectId).toBe(b.uuid);
    expect(sent.selections).toHaveLength(1);
    expect(sent.selections[0]).toMatchObject({ action: 'add', incoming: incomingB });
    await appliedOnServer.promise;
    expect(applyStatus).toBe(200);
    const persisted = await request.post(`${apiUrl}/api/find-rpd`, { headers, data: { complectId: b.id } });
    expect(persisted.status()).toBe(200);
    expect((await persisted.json()).templates).toEqual([expect.objectContaining({
      discipline: incomingB.discipline, id_profile_template: expect.any(Number),
    })]);

    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
    await expect(dialog).toBeHidden();
    // Тот же UUID, другое открытие: одной проверки UUID для Apply недостаточно.
    await update.click();
    await expect(apply).toBeDisabled();
    await expect(load).toBeEnabled();
    await load.click();
    await expect(dialog.getByText(nextIncomingB.discipline, { exact: true })).toBeVisible();
    const lateApply = page.waitForResponse(`${apiUrl}/api/complects/sync/apply`);
    const refreshed = page.waitForResponse(`${apiUrl}/api/get-rpd-complects`);
    releaseApply.release();
    expect((await lateApply).status()).toBe(200);
    expect((await refreshed).status()).toBe(200);
    await expect(dialog, 'Успех закрытого Apply не закрывает новое открытие B').toBeVisible();
    await expect(dialog.getByText(nextIncomingB.discipline, { exact: true })).toBeVisible();
    await expect(apply).toBeEnabled();
    await dialog.screenshot({ path: testInfo.outputPath('sync-late-apply-keeps-new-opening.png') });
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
    await expect(rowB, 'Кэш завершившейся цели обновлён после закрытия её диалога').toContainText('Обновлён');
    await page.reload();
    await expect(rowB).toContainText('Обновлён');

    expect(syncStateFromDb([a.id])).toEqual(beforeA);
    const afterB = syncStateFromDb([b.id]);
    expect(afterB.exchange).toEqual([expect.objectContaining({ id_rpd_complect: b.id, discipline: incomingB.discipline })]);
    expect(afterB.templates).toHaveLength(1);
    expect(afterB.fieldChanges).toEqual([expect.objectContaining({ field_key: '__new__' })]);
    expect(afterB.syncLog).toEqual([expect.objectContaining({ complect_id: b.id, user_id: 34, source: '1c' })]);
  } finally {
    releasePreview.release();
    releaseApply.release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
