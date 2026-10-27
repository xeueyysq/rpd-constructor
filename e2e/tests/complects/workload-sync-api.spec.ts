import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, password } from '../helpers';

async function headersFor(request: APIRequestContext, userName: string) {
  const response = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName, password } });
  expect(response.status()).toBe(200);
  return { Authorization: `Bearer ${(await response.json()).accessToken as string}` };
}

test('обновление часов сохраняет только выбранные поля одной РПД и достоверную историю', async ({ request }) => {
  const reader = await headersFor(request, 'admin');
  const manager = await headersFor(request, 'rop');
  async function profile(id: number) {
    const response = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers: reader, data: { id } });
    expect(response.status()).toBe(200);
    return response.json();
  }
  async function workflow() {
    const response = await request.get(`${apiUrl}/api/templates/200/workflow`, { headers: reader });
    expect(response.status()).toBe(200);
    return response.json();
  }
  const before = await Promise.all([200, 201, 202].map(profile));
  const beforeWorkflow = await workflow();
  const studyLoad = { 'Лекции': 34, 'Практические': 34, 'СРС': 40 };
  const response = await request.post(`${apiUrl}/api/complects/sync/apply`, {
    headers: manager,
    data: {
      complectId: 200,
      selections: [{
        action: 'update', id_1c: 200, fields: ['study_load', 'zet'],
        incoming: {
          discipline: 'Восстановление часов', semester: 1, record_type: 'discipline',
          department: 'Новая кафедра из 1С', teachers: ['Новый преподаватель'],
          place: 'Новое место', study_load: studyLoad, control_load: { 'Зачет': 18 }, zet: 4,
        },
      }],
    },
  });
  expect(response.status()).toBe(200);
  const after = await Promise.all([200, 201, 202].map(profile));
  // PostgreSQL действительно сохранил нагрузку и ЗЕТ; остальные поля и обе контрольные РПД не изменились.
  expect(after[0]).toEqual({
    ...before[0], study_load: studyLoad, zet: 4,
    study_plan_hours: {
      all: 144, lectures: 34, seminars: 34, contact: 68, independent_work: 40, control: 36,
      has_total: true, has_breakdown: true,
    },
    field_edits: {
      ...before[0].field_edits,
      study_load: { userId: null, fullname: '1С', at: expect.any(String) },
      zet: { userId: null, fullname: '1С', at: expect.any(String) },
    },
    fieldChanges: [
      { id: expect.any(Number), field_key: 'study_load', old_value: [{ name: 'Всего', id: '144' }], new_value: studyLoad },
      { id: expect.any(Number), field_key: 'zet', old_value: 3, new_value: 4 },
    ],
  });
  expect(after.slice(1)).toEqual(before.slice(1));
  expect(await workflow()).toEqual(beforeWorkflow);
  const history = await request.get(`${apiUrl}/api/complects/sync/changes?exchangeId=200`, { headers: manager });
  expect(history.status()).toBe(200);
  expect((await history.json()).map(({ field_key, old_value, new_value, id_profile_template }: {
    field_key: string; old_value: unknown; new_value: unknown; id_profile_template: number;
  }) => ({ field_key, old_value, new_value, id_profile_template }))).toEqual([
    { field_key: 'study_load', old_value: [{ name: 'Всего', id: '144' }], new_value: studyLoad, id_profile_template: 200 },
    { field_key: 'zet', old_value: 3, new_value: 4, id_profile_template: 200 },
  ]);
});
