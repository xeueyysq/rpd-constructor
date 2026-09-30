import { expect, test } from '@playwright/test';
import { apiUrl, password } from '../helpers';

test('РОП сохраняет, читает и удаляет комментарий к профильному шаблону без строки 1С', async ({ request }) => {
  const signIn = await request.post(`${apiUrl}/auth/sign-in`, {
    data: { userName: 'rop', password },
  });
  expect(signIn.status()).toBe(200);
  const headers = { Authorization: `Bearer ${(await signIn.json()).accessToken as string}` };
  const value = '<p>Комментарий РОП к целям</p>';

  const saved = await request.put(`${apiUrl}/api/upset-template-comment/104`, {
    headers, data: { field: 'goals', value },
  });
  expect(saved.status()).toBe(200);
  const comment = await saved.json();
  expect(comment).toEqual(expect.objectContaining({
    id: expect.any(Number), template_field: 'goals', comment_text: value,
    commentator_fullname: 'Руководов Тест Тестович',
  }));

  const profile = await request.post(`${apiUrl}/api/rpd-profile-templates`, {
    headers, data: { id: 104 },
  });
  expect(profile.status()).toBe(200);
  expect((await profile.json()).comments.goals).toEqual(expect.objectContaining({
    id: comment.id, comment_text: value,
    commentator_id: comment.commentator_id,
    commentator_fullname: 'Руководов Тест Тестович',
  }));

  const revisedValue = '<p>Уточнённый комментарий РОП к целям</p>';
  const revised = await request.put(`${apiUrl}/api/upset-template-comment/104`, {
    headers, data: { field: 'goals', value: revisedValue },
  });
  expect(revised.status()).toBe(200);
  expect(await revised.json()).toEqual(expect.objectContaining({
    id: comment.id, comment_text: revisedValue,
    commentator_id: comment.commentator_id,
    commentator_fullname: 'Руководов Тест Тестович',
  }));
  const reloaded = await request.post(`${apiUrl}/api/rpd-profile-templates`, {
    headers, data: { id: 104 },
  });
  expect(reloaded.status()).toBe(200);
  expect((await reloaded.json()).comments.goals).toEqual(expect.objectContaining({
    id: comment.id, comment_text: revisedValue,
    commentator_fullname: 'Руководов Тест Тестович',
  }));

  const deleted = await request.delete(`${apiUrl}/api/delete-template-comment/${comment.id}`, { headers });
  expect(deleted.status()).toBe(204);

  const afterDelete = await request.post(`${apiUrl}/api/rpd-profile-templates`, {
    headers, data: { id: 104 },
  });
  expect(afterDelete.status()).toBe(200);
  expect((await afterDelete.json()).comments.goals).toBeUndefined();
});
