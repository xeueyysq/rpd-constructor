import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, password, signIn } from '../helpers';

test.describe('API совместного редактирования', () => {
  test.describe.configure({ mode: 'serial' });

  async function headersFor(request: APIRequestContext, userName: string) {
    const response = await request.post(`${apiUrl}/auth/sign-in`, {
      data: { userName, password },
    });
    expect(response.status()).toBe(200);
    return { Authorization: `Bearer ${(await response.json()).accessToken as string}` };
  }

  test('версия обязательна, успешная запись возвращает автора, устаревшая — 409', async ({ page, request }) => {
    await signIn(page, 'teacher');
    const headers = await headersFor(request, 'teacher');
    const profile = await request.post(`${apiUrl}/api/rpd-profile-templates`, {
      headers, data: { id: 111 },
    });
    expect(profile.status()).toBe(200);
    const baseAt = (await profile.json()).field_edits?.goals?.at ?? null;

    const noVersion = await request.put(`${apiUrl}/api/update-json-value/111`, {
      headers, data: { fieldToUpdate: 'goals', value: '<p>Без версии</p>' },
    });
    expect(noVersion.status()).toBe(422);

    const value = '<p>Актуальные цели API</p>';
    const updated = await request.put(`${apiUrl}/api/update-json-value/111`, {
      headers, data: { fieldToUpdate: 'goals', value, baseAt },
    });
    expect(updated.status()).toBe(200);
    const result = await updated.json();
    expect(result).toEqual(expect.objectContaining({
      field: 'goals', value,
      edit: expect.objectContaining({
        fullname: 'Альфина Т.Т.',
        at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/),
      }),
    }));

    const stale = await request.put(`${apiUrl}/api/update-json-value/111`, {
      headers, data: { fieldToUpdate: 'goals', value: '<p>Устаревшие цели</p>', baseAt },
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error).toEqual(expect.objectContaining({
      field: 'goals', value,
      edit: expect.objectContaining({ fullname: 'Альфина Т.Т.', at: result.edit.at }),
    }));
  });

  test('присутствие показывает другого редактора и закрыто непривязанному', async ({ page, request }) => {
    await signIn(page, 'teacher2');
    const teacherHeaders = await headersFor(request, 'teacher');
    const secondHeaders = await headersFor(request, 'teacher2');
    const thirdHeaders = await headersFor(request, 'teacher3');

    const first = await request.post(`${apiUrl}/api/templates/111/presence`, { headers: teacherHeaders });
    expect(first.status()).toBe(200);
    const second = await request.post(`${apiUrl}/api/templates/111/presence`, { headers: secondHeaders });
    expect(second.status()).toBe(200);
    const presence = await second.json();
    expect(presence.editors).toEqual([{ userId: expect.any(Number), fullname: 'Альфина Т.Т.' }]);
    expect(presence.editors).not.toContainEqual(expect.objectContaining({ fullname: 'Яковлева Т.Т.' }));
    expect(presence.fieldEdits.goals).toEqual(expect.objectContaining({ fullname: 'Альфина Т.Т.' }));

    const forbidden = await request.post(`${apiUrl}/api/templates/111/presence`, { headers: thirdHeaders });
    expect(forbidden.status()).toBe(403);
  });
});
