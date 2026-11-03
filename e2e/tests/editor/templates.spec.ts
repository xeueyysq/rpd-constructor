import { expect, test } from '@playwright/test';
import { apiUrl, disciplines, openComplect, openTemplateFromTeacherList, password, signIn } from '../helpers';

test('преподаватель открывает шаблон и возвращается к списку через меню', async ({ page }) => {
  await signIn(page, 'teacher');
  const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await openTemplateFromTeacherList(page, row);
  await expect(page.getByText('Титульный лист', { exact: true }).last()).toBeVisible();
  await expect(page.getByText(disciplines.inProgress, { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Тестовая кафедра', { exact: true })).toBeVisible();
  await expect(page.getByText('ПРОРЕКТОР ПО ОБРАЗОВАТЕЛЬНОЙ ДЕЯТЕЛЬНОСТИ')).toBeVisible();
  await page.getByRole('button', { name: 'Список РПД' }).click();
  await expect(page).toHaveURL(/\/templates$/);
});

test('титул из 1С, компетенции другого регистра и повторный импорт сохраняют существующую РПД', async ({ page, request }) => {
  // Несколько полных перезагрузок редактора требуют большего общего бюджета в CI.
  test.slow();
  const auth = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName: 'rop', password } });
  expect(auth.status()).toBe(200);
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken as string}` };
  const incoming = {
    discipline: 'ВВЕДЕНИЕ В ПРОГРАММИРОВАНИЕ ДЛЯ РЕГРЕССИИ',
    department: 'Кафедра системного анализа для теста',
    semester: 1, record_type: 'discipline', teachers: [], zet: 2,
    place: 'Базовая часть', study_load: { 'Всего': 72 }, control_load: {},
  };
  const mixed = { ...incoming, discipline: 'Базы данных и SQL для регрессии' };
  async function importAgain() {
    const response = await request.post(`${apiUrl}/api/complects/sync/apply`, {
      headers, data: { complectId: 90, selections: [incoming, mixed].map((row) => ({ action: 'add', incoming: row })) },
    });
    expect(response.status()).toBe(200);
  }
  async function templates() {
    const response = await request.post(`${apiUrl}/api/find-rpd`, { headers, data: { complectId: 90 } });
    expect(response.status()).toBe(200);
    return (await response.json()).templates as Array<{
      id: number; discipline: string; id_profile_template: number | null; profile_template_public_id: string | null; status: string;
    }>;
  }
  await importAgain();
  const initial = await templates();
  expect(initial.map((row) => row.discipline).sort()).toEqual([
    'Базы данных и SQL для регрессии', 'Введение в программирование для регрессии',
  ]);
  const exchangeId = initial.find((row) => row.discipline === 'Введение в программирование для регрессии')!.id;
  const created = await request.post(`${apiUrl}/api/create-profile-template-from-1c`, {
    headers, data: { complectId: 90, id_1c: exchangeId, teacherIds: [] },
  });
  expect(created.status()).toBe(200);
  const { templateId } = await created.json() as { templateId: number };
  const results = await request.post(`${apiUrl}/api/set-results-data`, {
    headers,
    data: { complectId: 90, data: [{
      competence: 'УК-91 Проверять регрессию', indicator: 'УК-91.1 Сопоставляет дисциплину',
      disciplines: ['введение в программирование для регрессии'],
    }] },
  });
  expect(results.status()).toBe(200);

  await signIn(page, 'rop');
  const publicId = (await templates()).find((row) => row.id === exchangeId)!.profile_template_public_id!;
  await page.goto(`/templates/${publicId}`);
  await expect(page.getByText('Введение в программирование для регрессии', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Кафедра системного анализа для теста', { exact: true })).toBeVisible();
  await expect(page.getByText('ПРОРЕКТОР ПО ОБРАЗОВАТЕЛЬНОЙ ДЕЯТЕЛЬНОСТИ')).toBeVisible();
  await page.goto(`/templates/${publicId}/disciplineEvaluationsFunds`);
  await expect(page.getByRole('button', { name: 'УК-91 Проверять регрессию', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'УК-91 Проверять регрессию', exact: true })).toBeVisible();

  await page.goto(`/templates/${publicId}/disciplinePlannedResults`);
  await expect(page.locator('textarea:visible').first()).toHaveValue('УК-91 Проверять регрессию');
  await expect(page.locator('textarea:visible').nth(1)).toHaveValue('УК-91.1 Сопоставляет дисциплину');
  await page.reload();
  await expect(page.locator('textarea:visible').first()).toHaveValue('УК-91 Проверять регрессию');
  await expect(page.locator('textarea:visible').nth(1)).toHaveValue('УК-91.1 Сопоставляет дисциплину');

  // Уже сохранённая авторская компетенция имеет приоритет над данными комплекта.
  const saved = { 0: {
    competence: 'ПК-92 Авторская компетенция', indicator: 'ПК-92.1 Авторский индикатор',
    results: { know: 'Сохранённый результат', beAble: '', own: '' },
  } };
  const updated = await request.put(`${apiUrl}/api/update-json-value/${templateId}`, {
    headers, data: { fieldToUpdate: 'competencies', value: saved, baseAt: null },
  });
  expect(updated.status()).toBe(200);
  await page.reload();
  await expect(page.locator('textarea:visible').first()).toHaveValue('ПК-92 Авторская компетенция');
  await expect(page.locator('textarea:visible').nth(1)).toHaveValue('ПК-92.1 Авторский индикатор');
  await expect(page.locator('textarea:visible').nth(3)).toHaveValue('Сохранённый результат');
  await page.goto(`/templates/${publicId}/disciplineEvaluationsFunds`);
  await expect(page.getByRole('button', { name: 'ПК-92 Авторская компетенция', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'УК-91 Проверять регрессию', exact: true })).toHaveCount(0);

  const before = await templates();
  const workflow = await request.get(`${apiUrl}/api/templates/${templateId}/workflow`, { headers });
  expect(workflow.status()).toBe(200);
  const beforeWorkflow = await workflow.json();
  // Повторяется исходное прописное имя, а не отформатированное имя из списка.
  await importAgain();
  await importAgain();
  const identity = (rows: typeof before) => rows.map(({ id, discipline, id_profile_template, profile_template_public_id, status }) =>
    ({ id, discipline, id_profile_template, profile_template_public_id, status })).sort((a, b) => a.id - b.id);
  expect(identity(await templates())).toEqual(identity(before));
  const afterWorkflow = await request.get(`${apiUrl}/api/templates/${templateId}/workflow`, { headers });
  expect(afterWorkflow.status()).toBe(200);
  expect(await afterWorkflow.json()).toEqual(beforeWorkflow);
  const profile = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers, data: { id: templateId } });
  expect(profile.status()).toBe(200);
  expect((await profile.json()).competencies).toEqual(saved);
});

for (const role of ['admin', 'rop'] as const) {
  test(`${role} открывает готовый шаблон из комплекта`, async ({ page }) => {
    await signIn(page, role);
    await openComplect(page);
    await page.getByRole('row').filter({ hasText: disciplines.ready })
      .getByRole('button', { name: 'Меню шаблона' }).click();
    await page.getByRole('menuitem', { name: 'Открыть' }).click();
    await expect(page.getByText('Титульный лист', { exact: true }).last()).toBeVisible();
    await expect(page.getByText(disciplines.ready, { exact: true }).last()).toBeVisible();
  });
}
