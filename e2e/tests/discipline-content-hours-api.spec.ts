import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, password } from './helpers';

async function tokenFor(request: APIRequestContext, userName: string) {
  const response = await request.post(`${apiUrl}/auth/sign-in`, {
    data: { userName, password },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).accessToken as string;
}

test('часы плана защищены токеном и ролью, содержание доступно преподавателю', async ({ request }) => {
  const anonymous = await request.put(`${apiUrl}/api/update-json-value/103`, {
    data: { fieldToUpdate: 'content', value: {} },
  });
  expect(anonymous.status()).toBe(401);

  const headers = { Authorization: `Bearer ${await tokenFor(request, 'teacher2')}` };
  const forbiddenField = await request.put(`${apiUrl}/api/update-json-value/103`, {
    headers,
    data: { fieldToUpdate: 'study_load', value: {} },
  });
  expect(forbiddenField.status()).toBe(400);

  const forbiddenRole = await request.put(`${apiUrl}/api/rpd-profile-templates/103/study-load`, {
    headers,
    data: { hours: { lectures: 35 } },
  });
  expect(forbiddenRole.status()).toBe(403);

  // Копия шаблона не пересекается с UI-сценарием, который сохраняет содержание 103.
  const content = await request.put(`${apiUrl}/api/update-json-value/104`, {
    headers,
    data: { fieldToUpdate: 'content', value: { '0': { theme: 'Проверка сохранения' } } },
  });
  expect(content.status()).toBe(200);
});

test('РОП точечно меняет лекции, сохраняя объект 1С и неизвестные записи', async ({ request }) => {
  const headers = { Authorization: `Bearer ${await tokenFor(request, 'rop')}` };
  const response = await request.put(`${apiUrl}/api/rpd-profile-templates/104/study-load`, {
    headers,
    data: { hours: { lectures: 35 } },
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.study_load).toEqual(expect.objectContaining({
    'Лекции': '35',
    'Практика': '26',
    'Лабораторные': '8',
    'КРП': '0',
  }));
  expect(Array.isArray(result.study_load)).toBe(false);
  expect(result.study_plan_hours.contact).toBe(69);
});
