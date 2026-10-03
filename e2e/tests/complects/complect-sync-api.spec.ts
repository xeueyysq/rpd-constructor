import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, complects, password } from '../helpers';

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
