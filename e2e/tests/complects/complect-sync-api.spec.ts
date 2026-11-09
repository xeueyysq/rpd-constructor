import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, complects, password, signInWithCredentials } from '../helpers';
import { openFixtureComplect, profileFor, syncFixtures, syncStateFromDb } from '../list3';

type SyncRow = {
  id: number;
  discipline: string;
  id_profile_template: number | null;
  profile_template_public_id: string | null;
  removed_at: string | null;
  syncStatus: string;
  participants: unknown[];
};

async function rowsFor(request: APIRequestContext, headers: Record<string, string>, complectId: number) {
  const response = await request.post(`${apiUrl}/api/find-rpd`, { headers, data: { complectId } });
  expect(response.status()).toBe(200);
  return (await response.json()).templates as SyncRow[];
}

async function headersFor(request: APIRequestContext, userName = 'rop') {
  const response = await request.post(`${apiUrl}/auth/sign-in`, {
    data: { userName, password },
  });
  expect(response.status()).toBe(200);
  return { Authorization: `Bearer ${(await response.json()).accessToken as string}` };
}

test('find-rpd отдаёт последнюю группу 1С с преподавателями и дату текущего статуса', async ({ request }) => {
  const headers = await headersFor(request);
  const response = await request.post(`${apiUrl}/api/find-rpd`, {
    headers, data: { complectId: complects.main.uuid },
  });
  expect(response.status()).toBe(200);
  const { templates } = await response.json();
  const row = templates.find((item: { id: number }) => item.id === 107);
  expect(row).toMatchObject({
    status: 'in_progress',
    statusChangedAt: '2025-01-07T00:00:00.000Z',
    latestChanges: { count: 2, lastAppliedAt: '2025-02-02T00:00:00.000Z' },
    syncStatus: 'updated',
    syncChangedAt: '2025-02-02T00:00:00.000Z',
    lastChangeSummary: ['zet'],
  });
  expect(row).not.toHaveProperty('pendingChanges');
  expect(row.lastChangeSummary).not.toContain('__new__');
});

test('диалог изменений отдаёт только последнюю группу, включая подтверждённое поле', async ({ request }) => {
  const headers = await headersFor(request);
  const response = await request.get(`${apiUrl}/api/complects/sync/changes?exchangeId=107`, { headers });
  expect(response.status()).toBe(200);
  const changes = await response.json();
  expect(changes).toEqual([
    { id: 102, field_key: 'zet', old_value: 3, new_value: 4, applied_at: '2025-02-02T00:00:00.000Z', id_profile_template: 107 },
    { id: 103, field_key: 'teachers', old_value: [], new_value: ['Третьева Тест Тестовна'], applied_at: '2025-02-02T00:00:00.000Z', id_profile_template: null },
  ]);
});

test('снимок преподавателя содержит дату статуса, а уведомления — последнее значение поля', async ({ request }) => {
  const headers = await headersFor(request, 'teacher3');
  const workflow = await request.get(`${apiUrl}/api/templates/107/workflow`, { headers });
  expect(workflow.status()).toBe(200);
  expect(await workflow.json()).toMatchObject({ status: 'in_progress', statusChangedAt: '2025-01-07T00:00:00.000Z' });
  const profile = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers, data: { id: 107 } });
  expect(profile.status()).toBe(200);
  expect((await profile.json()).fieldChanges).toEqual([{ id: 102, field_key: 'zet', old_value: 3, new_value: 4 }]);
});

test('маршрут подтверждения изменений удалён', async ({ request }) => {
  const headers = await headersFor(request);
  const response = await request.post(`${apiUrl}/api/acknowledge-field-changes`, {
    headers, data: { exchangeId: 107 },
  });
  expect(response.status()).toBe(404);
});

test('чужой РОП не читает изменения строки', async ({ request }) => {
  const headers = await headersFor(request, 'rop2');
  const response = await request.get(`${apiUrl}/api/complects/sync/changes?exchangeId=107`, { headers });
  expect(response.status()).toBe(403);
});

test('sync/remove чужой или отсутствующей строки возвращает 404 и откатывает весь смешанный batch', async ({ request }) => {
  const headers = await headersFor(request, syncFixtures.owner);
  const foreignHeaders = await headersFor(request, syncFixtures.foreignOwner);
  const ownBefore = await rowsFor(request, headers, syncFixtures.own.id);
  const foreignBefore = await rowsFor(request, foreignHeaders, syncFixtures.foreign.id);
  const before = syncStateFromDb([syncFixtures.own.id, syncFixtures.foreign.id]);
  expect(before.exchange).toHaveLength(2);
  expect(before.exchange.every((row) => row.removed_at === null)).toBe(true);
  expect(before.templates).toHaveLength(2);
  expect(before.participants).toHaveLength(2);
  expect(before.fieldChanges).toEqual([]);
  expect(before.syncLog).toEqual([]);
  const errors: unknown[] = [];
  for (const invalidId of [syncFixtures.foreign.exchangeId, 2147483000]) {
    const response = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers, data: {
      complectId: syncFixtures.own.id,
      selections: [
        { action: 'remove', id_1c: syncFixtures.own.exchangeId },
        { action: 'remove', id_1c: invalidId },
      ],
    } });
    expect(response.status(), 'Чужая/отсутствующая строка не должна подтверждать частичный batch').toBe(404);
    errors.push(await response.json());
    expect(await rowsFor(request, headers, syncFixtures.own.id)).toEqual(ownBefore);
    expect(await rowsFor(request, foreignHeaders, syncFixtures.foreign.id)).toEqual(foreignBefore);
    expect(syncStateFromDb([syncFixtures.own.id, syncFixtures.foreign.id]),
      'Откатываются обе строки, РПД, участники, история, syncLog и метаданные комплекта').toEqual(before);
  }
  expect(errors[0], 'Ответ не раскрывает существование строки в чужом комплекте').toEqual(errors[1]);
});

test('sync add → remove → reload → restore сохраняет РПД, содержимое, участников и историю', async ({ page, request }, testInfo) => {
  const target = syncFixtures.lifecycle;
  const headers = await headersFor(request, syncFixtures.owner);
  const incoming = {
    discipline: 'Сохранение РПД при синхронизации', department: 'Кафедра sync',
    semester: 1, record_type: 'discipline', teachers: [], zet: 3, place: 'Базовая часть',
    study_load: { 'Всего': 108, 'Лекции': 8 }, control_load: {},
  };
  expect(await rowsFor(request, headers, target.id)).toEqual([]);
  const added = await request.post(`${apiUrl}/api/complects/sync/apply`, {
    headers, data: { complectId: target.uuid, selections: [{ action: 'add', incoming }] },
  });
  expect(added.status()).toBe(200);
  const addLogId = (await added.json()).syncLogId as number;
  const [created] = await rowsFor(request, headers, target.id);
  expect(created).toMatchObject({ id: expect.any(Number), id_profile_template: expect.any(Number),
    profile_template_public_id: expect.any(String), syncStatus: 'new', removed_at: null, participants: [] });
  const templateId = created!.id_profile_template!;
  const publicId = created!.profile_template_public_id!;
  const participants = await request.put(`${apiUrl}/api/templates/${templateId}/participants`, {
    headers, data: { teacherIds: [20], baseTeacherIds: [] },
  });
  expect(participants.status()).toBe(200);
  const content = { 0: { theme: 'Авторская тема sync', lectures: 8, seminars: 6, independent_work: 4, control: 0 } };
  for (const [fieldToUpdate, value] of Object.entries({ goals: '<p>Авторские цели sync</p>', content })) {
    const edited = await request.put(`${apiUrl}/api/update-json-value/${templateId}`, {
      headers, data: { fieldToUpdate, value, baseAt: null },
    });
    expect(edited.status()).toBe(200);
  }
  const profileBefore = await profileFor(request, headers, templateId);
  const [assigned] = await rowsFor(request, headers, target.id);
  const before = syncStateFromDb([target.id]);
  expect(before.fieldChanges).toEqual([expect.objectContaining({ sync_log_id: addLogId,
    id_1c_exchange: created!.id, field_key: '__new__' })]);
  expect(before.participants).toEqual([expect.objectContaining({ user_id: 20, template_id: templateId, state: 'assigned' })]);

  const removed = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers, data: {
    complectId: target.uuid, selections: [{ action: 'remove', id_1c: created!.id }],
  } });
  expect(removed.status()).toBe(200);
  const removeLogId = (await removed.json()).syncLogId as number;
  const [removedRow] = await rowsFor(request, headers, target.id);
  expect(removedRow).toMatchObject({ id: created!.id, id_profile_template: templateId,
    profile_template_public_id: publicId, syncStatus: 'removed', removed_at: expect.any(String),
    participants: assigned!.participants });
  const afterRemove = syncStateFromDb([target.id]);
  expect(afterRemove.templates).toEqual(before.templates);
  expect(afterRemove.statuses).toEqual(before.statuses);
  expect(afterRemove.participants).toEqual(before.participants);
  expect(afterRemove.fieldChanges).toEqual([...before.fieldChanges, expect.objectContaining({
    sync_log_id: removeLogId, id_1c_exchange: created!.id, id_profile_template: templateId,
    field_key: 'removed', old_value: { discipline: incoming.discipline }, new_value: null,
  })]);
  expect(await profileFor(request, headers, templateId)).toEqual(profileBefore);

  await signInWithCredentials(page, syncFixtures.owner, password);
  await expect(page).toHaveURL(/\/complects$/);
  await openFixtureComplect(page, target.id);
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: incoming.discipline });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Синхронова Тест Тестовна');
  await row.getByRole('button', { name: `Изменения 1С: строка ${created!.id}`, exact: true }).click();
  const changes = page.getByRole('dialog', { name: 'Изменения из 1С', exact: true });
  await expect(changes).toContainText('Удалена из плана');
  await expect(changes).toContainText(incoming.discipline);
  await changes.screenshot({ path: testInfo.outputPath('sync-removed-retained.png') });
  await changes.getByRole('button', { name: 'Закрыть', exact: true }).click();

  const restored = await request.post(`${apiUrl}/api/complects/sync/apply`, {
    headers, data: { complectId: target.uuid, selections: [{ action: 'add', incoming }] },
  });
  expect(restored.status()).toBe(200);
  const restoreLogId = (await restored.json()).syncLogId as number;
  const restoredRows = await rowsFor(request, headers, target.id);
  expect(restoredRows).toHaveLength(1);
  expect(restoredRows[0]).toMatchObject({ id: created!.id, id_profile_template: templateId,
    profile_template_public_id: publicId, syncStatus: 'new', removed_at: null, participants: assigned!.participants });
  const afterRestore = syncStateFromDb([target.id]);
  expect(afterRestore.templates).toEqual(before.templates);
  expect(afterRestore.statuses).toEqual(before.statuses);
  expect(afterRestore.participants).toEqual(before.participants);
  expect(afterRestore.exchange).toEqual(before.exchange);
  expect(afterRestore.fieldChanges).toEqual([...afterRemove.fieldChanges, expect.objectContaining({
    sync_log_id: restoreLogId, id_1c_exchange: created!.id, field_key: '__new__',
  })]);
  expect(afterRestore.syncLog).toEqual([addLogId, removeLogId, restoreLogId].map((id) =>
    expect.objectContaining({ id, complect_id: target.id, user_id: 32, source: '1c' })));
  expect(await profileFor(request, headers, templateId)).toEqual(profileBefore);
  await page.goto(`/templates/${publicId}/aimsPage`);
  await expect(page.getByText('Авторские цели sync', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Авторские цели sync', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Содержание дисциплины', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Содержание дисциплины' })).toContainText('Авторская тема sync');
});
