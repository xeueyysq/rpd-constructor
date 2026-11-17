import { expect, test } from '@playwright/test';
import { apiUrl, password, signInWithCredentials } from '../helpers';

test('созданная РПД показывает составную аттестацию после загрузки, а ручная форма переживает sync', async ({ page, request }) => {
  const auth = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName: 'certification-rop', password } });
  expect(auth.status()).toBe(200);
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken as string}` };
  const incoming = {
    discipline: 'Аттестация для регрессии', semester: 1, record_type: 'Б1.О.99',
    department: 'Тестовая кафедра', teachers: [], zet: 2,
    place: 'обязательной части', study_load: { 'Всего': 72 },
    control_load: { 'Курсовая работа': 0, 'Экзамен': 36 },
  };
  const added = await request.post(`${apiUrl}/api/complects/sync/apply`, {
    headers, data: { complectId: 91, selections: [{ action: 'add', incoming }] },
  });
  expect(added.status()).toBe(200);
  const list = await request.post(`${apiUrl}/api/find-rpd`, { headers, data: { complectId: 91 } });
  expect(list.status()).toBe(200);
  const row = ((await list.json()).templates as Array<{
    id: number; discipline: string; id_profile_template: number | null; profile_template_public_id: string | null;
  }>).find((item) => item.discipline === incoming.discipline);
  expect(row?.id_profile_template).toEqual(expect.any(Number));
  expect(row?.profile_template_public_id).toEqual(expect.any(String));
  const templateId = row!.id_profile_template!;

  async function profile() {
    const response = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers, data: { id: templateId } });
    expect(response.status()).toBe(200);
    return response.json();
  }
  expect((await profile()).certification).toBe('Экзамен + курсовая работа');
  await signInWithCredentials(page, 'certification-rop', password);
  await expect(page).toHaveURL(/\/complects$/);
  await page.goto(`/templates/${row!.profile_template_public_id}/disciplinePlace`);
  const selector = page.locator('#certification-select');
  await expect(selector).toHaveText('экзамен + курсовая работа');
  await page.reload();
  await expect(selector).toHaveText('экзамен + курсовая работа');

  const studySynced = await request.post(`${apiUrl}/api/complects/sync/apply`, {
    headers, data: { complectId: 91, selections: [{ action: 'update', id_1c: row!.id,
      incoming: { ...incoming, study_load: { 'Всего': 90 }, control_load: { 'Зачет': 0 } }, fields: ['study_load'] }] },
  });
  expect(studySynced.status()).toBe(200);
  const afterStudySync = await profile();
  expect(afterStudySync.study_load).toEqual({ 'Всего': 90 });
  expect(afterStudySync.control_load).toEqual(incoming.control_load);
  expect(afterStudySync.certification).toBe('Экзамен + курсовая работа');
  const sourceRevision = afterStudySync.field_edits?.certification;
  expect(sourceRevision).toMatchObject({ userId: null, fullname: '1С', at: expect.any(String) });
  expect(Number.isFinite(Date.parse(sourceRevision.at))).toBe(true);
  await page.reload();
  await expect(selector).toHaveText('экзамен + курсовая работа');

  const manual = await request.put(`${apiUrl}/api/update-json-value/${templateId}`, {
    headers, data: { fieldToUpdate: 'certification', value: 'Индивидуальная форма',
      baseAt: afterStudySync.field_edits?.certification?.at ?? null },
  });
  expect(manual.status()).toBe(200);
  const afterManual = await profile();
  expect(afterManual.certification).toBe('Индивидуальная форма');
  const manualRevision = afterManual.field_edits?.certification;
  expect(manualRevision?.userId).toBe(37);
  expect(manualRevision?.at).toEqual(expect.any(String));
  expect(Number.isFinite(Date.parse(manualRevision.at))).toBe(true);
  await page.reload();
  await expect(selector).toHaveText('Индивидуальная форма');

  const synced = await request.post(`${apiUrl}/api/complects/sync/apply`, {
    headers, data: { complectId: 91, selections: [{ action: 'update', id_1c: row!.id,
      incoming: { ...incoming, control_load: { 'Курсовой проект': 0, 'Зачет': 0 } }, fields: ['control_load'] }] },
  });
  expect(synced.status()).toBe(200);
  const reloaded = await profile();
  expect(reloaded.certification).toBe('Индивидуальная форма');
  expect(reloaded.control_load).toEqual({ 'Курсовой проект': 0, 'Зачет': 0 });
  expect(reloaded.field_edits?.certification).toEqual(manualRevision);
  await page.reload();
  await expect(selector).toHaveText('Индивидуальная форма');
});
