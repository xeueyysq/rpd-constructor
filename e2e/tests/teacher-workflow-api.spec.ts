import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, complects, password, signIn } from './helpers';

async function headersFor(request: APIRequestContext, userName: string) {
  const response = await request.post(`${apiUrl}/auth/sign-in`, {
    data: { userName, password },
  });
  expect(response.status()).toBe(200);
  return { Authorization: `Bearer ${(await response.json()).accessToken as string}` };
}

test('workflow без токена возвращает 401', async ({ page, request }) => {
  await signIn(page, 'rop');
  const get = await request.get(`${apiUrl}/api/templates/108/workflow`);
  const post = await request.post(`${apiUrl}/api/templates/108/workflow`, {
    data: { action: 'accept' },
  });
  expect(get.status()).toBe(401);
  expect(post.status()).toBe(401);
});

test.describe('права второго РОП на отдельном комплекте', () => {
  test.describe.configure({ mode: 'serial' });

  test('чужой РОП получает 403 для чужого комплекта и 200 для своего', async ({ page, request }) => {
    test.setTimeout(90_000);
    await signIn(page, 'rop2');
    const headers = await headersFor(request, 'rop2');
    const foreign = [
      await request.get(`${apiUrl}/api/templates/108/workflow`, { headers }),
      await request.post(`${apiUrl}/api/templates/108/workflow`, {
        headers, data: { action: 'accept' },
      }),
      await request.post(`${apiUrl}/api/rpd-profile-templates`, {
        headers, data: { id: 108 },
      }),
      await request.get(`${apiUrl}/api/generate-pdf?id=108`, { headers }),
      await request.post(`${apiUrl}/api/find-rpd`, {
        headers, data: { complectId: complects.main.uuid },
      }),
    ];
    for (const response of foreign) expect(response.status()).toBe(403);

    const own = [
      await request.get(`${apiUrl}/api/templates/109/workflow`, { headers }),
      await request.post(`${apiUrl}/api/templates/109/workflow`, {
        headers, data: { action: 'assign', userId: 14 },
      }),
      await request.post(`${apiUrl}/api/rpd-profile-templates`, {
        headers, data: { id: 109 },
      }),
      await request.get(`${apiUrl}/api/generate-pdf?id=109`, { headers }),
      await request.post(`${apiUrl}/api/find-rpd`, {
        headers, data: { complectId: complects.other.uuid },
      }),
    ];
    for (const response of own) expect(response.status()).toBe(200);
  });
});

test('непривязанный преподаватель не читает workflow и PDF и не редактирует JSON', async ({ page, request }) => {
  await signIn(page, 'teacher3');
  const headers = await headersFor(request, 'teacher3');
  const responses = [
    await request.get(`${apiUrl}/api/templates/108/workflow`, { headers }),
    await request.post(`${apiUrl}/api/templates/108/workflow`, {
      headers, data: { action: 'finish' },
    }),
    await request.get(`${apiUrl}/api/generate-pdf?id=108`, { headers }),
    await request.put(`${apiUrl}/api/update-json-value/108`, {
      headers, data: { fieldToUpdate: 'content', value: {} },
    }),
  ];
  for (const response of responses) expect(response.status()).toBe(403);
});

test('refine без комментария даёт 422, состав ready защищён 409', async ({ page, request }) => {
  await signIn(page, 'rop');
  const headers = await headersFor(request, 'rop');
  const noComment = await request.post(`${apiUrl}/api/templates/101/workflow`, {
    headers, data: { action: 'refine' },
  });
  expect(noComment.status()).toBe(422);
  for (const data of [
    { action: 'assign', userId: 14 },
    { action: 'unassign', userId: 10 },
  ]) {
    const response = await request.post(`${apiUrl}/api/templates/101/workflow`, { headers, data });
    expect(response.status()).toBe(409);
  }
});

test('РОП получает PDF с сигнатурой %PDF-', async ({ page, request }) => {
  test.setTimeout(90_000);
  await signIn(page, 'rop');
  const headers = await headersFor(request, 'rop');
  const response = await request.get(`${apiUrl}/api/generate-pdf?id=108`, { headers });
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('DOCX листа согласования с двумя преподавателями доступен РОП', async ({ page, request }) => {
  test.setTimeout(90_000);
  await signIn(page, 'rop');
  const headers = await headersFor(request, 'rop');
  const profile = await request.post(`${apiUrl}/api/rpd-profile-templates`, {
    headers, data: { id: 108 },
  });
  expect(profile.status()).toBe(200);
  const teachers = (await profile.json()).teachers as Array<{ fullname: string }>;
  expect(teachers.map((teacher) => teacher.fullname)).toEqual([
    'Альфина Тест Тестовна',
    'Яковлева Тест Тестовна',
  ]);

  const response = await request.get(`${apiUrl}/api/generate-docx?id=108`, { headers });
  expect(response.status()).toBe(200);
  // В e2e нет JSZip: проверяем контейнер DOCX по сигнатуре ZIP.
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
});

test('DOCX открытого через UI шаблона доступен по public_id', async ({ page, request }) => {
  await signIn(page, 'rop');
  const headers = await headersFor(request, 'rop');
  const response = await request.get(`${apiUrl}/api/generate-docx?id=a108a108a108`, { headers });
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
});
