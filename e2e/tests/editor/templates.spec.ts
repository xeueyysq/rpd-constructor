import { expect, test } from '@playwright/test';
import { apiUrl, disciplines, openComplect, openTemplateFromTeacherList, password, signIn } from '../helpers';

test('преподаватель открывает шаблон по ссылке и возвращается к списку', async ({ page }) => {
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
  // Этот сценарий открывает один и тот же редактор с независимыми входами под тремя ролями.
  test.setTimeout(120_000);
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
  const initialized = initial.find((row) => row.id === exchangeId)!;
  expect(initialized.status).toBe('created');
  expect(initialized.id_profile_template).toEqual(expect.any(Number));
  expect(initialized.profile_template_public_id).toEqual(expect.any(String));
  const templateId = initialized.id_profile_template!;
  const initialWorkflow = await request.get(`${apiUrl}/api/templates/${templateId}/workflow`, { headers });
  expect(initialWorkflow.status()).toBe(200);
  expect((await initialWorkflow.json()).participants).toEqual([]);
  const results = await request.post(`${apiUrl}/api/set-results-data`, {
    headers,
    data: { complectId: 90, data: [{
      competence: 'УК-91 Проверять регрессию', indicator: 'УК-91.1 Сопоставляет дисциплину',
      disciplines: ['введение в программирование для регрессии'],
    }] },
  });
  expect(results.status()).toBe(200);
  const available = await request.get(`${apiUrl}/api/assignable-teachers`, { headers });
  expect(available.status()).toBe(200);
  const people = await available.json() as Array<{ id: number; fullname: string }>;
  const assigned = await request.put(`${apiUrl}/api/templates/${templateId}/participants`, {
    headers, data: { baseTeacherIds: [], teacherIds: ['Альфина Тест Тестовна', 'Другов Тест Тестович'].map((name) => people.find((person) => person.fullname === name)!.id) },
  });
  expect(assigned.status()).toBe(200);
  const updateCompetencies = async (value: unknown) => {
    const profile = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers, data: { id: templateId } });
    expect(profile.status()).toBe(200);
    const current = await profile.json();
    const updated = await request.put(`${apiUrl}/api/update-json-value/${templateId}`, {
      headers, data: { fieldToUpdate: 'competencies', value, baseAt: current.field_edits?.competencies?.at ?? null },
    });
    expect(updated.status()).toBe(200);
  };

  await signIn(page, 'rop');
  const publicId = (await templates()).find((row) => row.id === exchangeId)!.profile_template_public_id!;
  const plannedResults = `/templates/${publicId}/disciplinePlannedResults`;
  await page.goto(`/templates/${publicId}`);
  await expect(page.getByText('Введение в программирование для регрессии', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Кафедра системного анализа для теста', { exact: true })).toBeVisible();
  await expect(page.getByText('ПРОРЕКТОР ПО ОБРАЗОВАТЕЛЬНОЙ ДЕЯТЕЛЬНОСТИ')).toBeVisible();
  await page.goto(`/templates/${publicId}/disciplineEvaluationsFunds`);
  await expect(page.getByRole('button', { name: 'УК-91 Проверять регрессию', exact: true })).toBeVisible();

  await page.goto(plannedResults);
  await expect(page.locator('textarea:visible').first()).toHaveValue('УК-91 Проверять регрессию');
  await expect(page.locator('textarea:visible').nth(1)).toHaveValue('УК-91.1 Сопоставляет дисциплину');

  // Настоящий профиль из PostgreSQL, включая null; ответ API не подменяется.
  const signInAs = async (actor: 'rop' | 'teacher' | 'rop2') => {
    await page.getByRole('button', { name: 'Открыть меню аккаунта', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Выйти', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await signIn(page, actor);
    if (actor === 'rop2') {
      await page.getByRole('button', { name: 'Открыть меню аккаунта', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Преподаватель', exact: true }).click();
    }
  };
  const emptyCases = [
    { value: null, actors: ['rop', 'teacher', 'rop2'] as const },
    { value: { 0: { competence: '', indicator: '', results: { know: '', beAble: '', own: '' } } }, actors: ['rop'] as const },
    { value: {}, actors: ['teacher'] as const },
  ];
  for (const { value, actors } of emptyCases) {
    await updateCompetencies(value);
    for (const actor of actors) {
      if (value === null && actor === 'rop') {
        await page.reload();
      } else {
        await signInAs(actor);
        await page.goto(plannedResults);
      }
      await expect(page.locator('textarea:visible').first()).toHaveValue('УК-91 Проверять регрессию');
      await expect(page.locator('textarea:visible').nth(1)).toHaveValue('УК-91.1 Сопоставляет дисциплину');
      if (actor === 'rop') await expect(page.locator('textarea:visible').first()).toBeEnabled();
      else for (const textarea of await page.locator('textarea:visible').all()) await expect(textarea).toBeDisabled();
    }
  }
  // Уже сохранённая авторская компетенция имеет приоритет над данными комплекта.
  const saved = { 0: {
    competence: 'ПК-92 Авторская компетенция', indicator: 'ПК-92.1 Авторский индикатор',
    results: { know: 'Сохранённый результат', beAble: '', own: '' },
  } };
  await updateCompetencies(saved);
  await signInAs('rop');
  await page.goto(plannedResults);
  await expect(page.locator('textarea:visible').first()).toHaveValue('ПК-92 Авторская компетенция');
  await expect(page.locator('textarea:visible').nth(1)).toHaveValue('ПК-92.1 Авторский индикатор');
  await expect(page.locator('textarea:visible').nth(3)).toHaveValue('Сохранённый результат');
  saved[0].results.know = 'Сохранённый результат РОП';
  await page.locator('textarea:visible').nth(3).fill(saved[0].results.know);
  const savedByEditor = page.waitForResponse((response) => response.url().endsWith(`/api/update-json-value/${templateId}`) && response.request().method() === 'PUT');
  await page.locator('textarea:visible').nth(3).press('Tab');
  expect((await savedByEditor).status()).toBe(200);
  for (const actor of ['teacher', 'rop2'] as const) {
    await signInAs(actor);
    await page.goto(plannedResults);
    await expect(page.locator('textarea:visible').first()).toHaveValue(saved[0].competence);
    await expect(page.locator('textarea:visible').nth(3)).toHaveValue(saved[0].results.know);
    for (const textarea of await page.locator('textarea:visible').all()) await expect(textarea).toBeDisabled();
  }
  await signInAs('rop');
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

test('планируемые результаты загружают компетенции комплекта после ошибки и перезагрузки', async ({ page }) => {
  await signIn(page, 'rop');
  // В «Алгоритмах для теста» нет своих компетенций, а матрица уже содержит эту дисциплину.
  const matrixUrl = '**/api/get-results-data?*';
  await page.route(matrixUrl, async (route) => {
    await route.fulfill({ response: await route.fetch(), status: 503, json: { message: 'synthetic unavailable matrix' } });
  });
  await page.goto('/templates/aaaaaaaaaaaa/disciplinePlannedResults');
  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert).toContainText('Не удалось загрузить компетенции комплекта');
  await page.unroute(matrixUrl);
  await page.reload();
  await expect(page.locator('textarea:visible').first()).toHaveValue('ТЕСТ-1 Анализировать учебные данные');
  await expect(alert).toHaveCount(0);
});

for (const role of ['admin', 'rop'] as const) {
  test(`${role} открывает готовый шаблон из комплекта`, async ({ page }) => {
    await signIn(page, role);
    await openComplect(page);
    await page.getByRole('row').filter({ hasText: disciplines.ready })
      .getByRole('link', { name: disciplines.ready, exact: true }).click();
    await expect(page.getByText('Титульный лист', { exact: true }).last()).toBeVisible();
    await expect(page.getByText(disciplines.ready, { exact: true }).last()).toBeVisible();
  });
}
