import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, password } from './helpers';

function userPayload(name: string, role = 2) {
  return {
    name,
    password,
    role,
    fullname: { surname: 'Пробнов', name: 'Тест', patronymic: 'Тестович' },
  };
}

async function accessToken(request: APIRequestContext, userName: string) {
  const response = await request.post(`${apiUrl}/auth/sign-in`, {
    data: { userName, password },
  });
  expect(response.status()).toBe(200);
  return (await response.json()).accessToken as string;
}

test('маршруты пользователей требуют токен и роль администратора', async ({ request }) => {
  const anonymous = await request.get(`${apiUrl}/api/users`);
  expect(anonymous.status()).toBe(401);

  const token = await accessToken(request, 'rop');
  const headers = { Authorization: `Bearer ${token}` };
  const responses = [
    await request.get(`${apiUrl}/api/users`, { headers }),
    await request.post(`${apiUrl}/api/users`, { headers, data: userPayload('unuseduser') }),
    await request.put(`${apiUrl}/api/users/10`, { headers, data: userPayload('unuseduser') }),
    await request.patch(`${apiUrl}/api/users`, { headers, data: { ids: [10], is_active: false } }),
  ];
  for (const response of responses) {
    expect(response.status()).toBe(403);
  }
});

test('публичная регистрация удалена', async ({ request }) => {
  const response = await request.post(`${apiUrl}/auth/sign-up`, { data: userPayload('unuseduser') });
  expect(response.status()).toBe(404);
});

test('админ получает безопасный список и ошибки валидации', async ({ request }) => {
  const token = await accessToken(request, 'admin');
  const headers = { Authorization: `Bearer ${token}` };

  const duplicate = await request.post(`${apiUrl}/api/users`, {
    headers,
    data: userPayload('teacher2'),
  });
  expect(duplicate.status()).toBe(409);

  const invalidRole = await request.put(`${apiUrl}/api/users/10`, {
    headers,
    data: userPayload('teacher2', 1),
  });
  expect(invalidRole.status()).toBe(422);

  const response = await request.get(`${apiUrl}/api/users`, { headers });
  expect(response.status()).toBe(200);
  const users = await response.json() as Array<Record<string, unknown>>;
  expect(users.length).toBeGreaterThan(0);
  expect(users.some((user) => user.name === 'admin' || user.role === 1)).toBe(false);
  for (const user of users) {
    expect(user).not.toHaveProperty('password');
    expect(user).toEqual(expect.objectContaining({
      id: expect.any(Number),
      name: expect.any(String),
      role: expect.any(Number),
      is_active: expect.any(Boolean),
    }));
  }
});

test('refresh деактивированного пользователя возвращает 401', async ({ request }) => {
  const token = await accessToken(request, 'admin');
  const headers = { Authorization: `Bearer ${token}` };
  const name = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const created = await request.post(`${apiUrl}/api/users`, {
    headers,
    data: userPayload(name),
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json() as { id: number };

  const userContext = await playwrightRequest.newContext({
    extraHTTPHeaders: { 'User-Agent': 'Playwright E2E', Accept: 'application/json' },
  });
  try {
    const signInResponse = await userContext.post(`${apiUrl}/auth/sign-in`, {
      data: { userName: name, password },
    });
    expect(signInResponse.status()).toBe(200);

    const deactivated = await request.patch(`${apiUrl}/api/users`, {
      headers,
      data: { ids: [id], is_active: false },
    });
    expect(deactivated.status()).toBe(200);
    expect(await deactivated.json()).toEqual({ updated: 1 });

    const refreshed = await userContext.post(`${apiUrl}/auth/refresh`);
    expect(refreshed.status()).toBe(401);
  } finally {
    await userContext.dispose();
  }
});
