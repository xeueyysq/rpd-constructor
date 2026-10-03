import { expect, test, type APIRequestContext } from '@playwright/test';
import { apiUrl, complects, password, signIn } from '../helpers';

async function adminHeaders(request: APIRequestContext) {
  const response = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName: 'admin', password } });
  expect(response.status()).toBe(200);
  return { Authorization: `Bearer ${(await response.json()).accessToken as string}` };
}

test('админ: владелец комплекта и его диалог оформлены как назначение преподавателей', async ({ page, request }) => {
  const headers = await adminHeaders(request);
  const list = await request.get(`${apiUrl}/api/get-rpd-complects`, { headers });
  expect(list.status()).toBe(200);
  const main = (await list.json() as { id: number; owner: { userId: number }[] }[]).find((complect) => complect.id === 100)!;
  const ownerId = main.owner[0].userId;

  await signIn(page, 'admin');
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: complects.main.profile, exact: true }) });
  // ФИО владельца — кликабельная подпись, отдельной кнопки «Назначить РОП» нет.
  const owner = row.getByRole('button', { name: 'Руководов Тест Тестович', exact: true });
  await expect(owner).toBeVisible();
  await expect(row.getByRole('button', { name: 'Назначить РОП' })).toHaveCount(0);

  try {
    await owner.click();
    const dialog = page.getByRole('dialog', { name: `РОП: ${complects.main.profile} 2025` });
    const rops = dialog.getByRole('radiogroup', { name: 'РОП' });
    await expect(rops.getByRole('radio', { name: 'Руководов Тест Тестович' })).toBeChecked();
    await dialog.getByLabel('Поиск РОП').fill('Другов');
    await expect(rops.getByRole('radio')).toHaveCount(1);
    // Выбор применяется сразу, как флажок в диалоге преподавателей.
    await rops.getByRole('radio', { name: 'Другов Тест Тестович' }).click();
    await expect(rops.getByRole('radio', { name: 'Другов Тест Тестович' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(row.getByRole('button', { name: 'Другов Тест Тестович', exact: true })).toBeVisible();
  } finally {
    const restored = await request.put(`${apiUrl}/api/complects/100/owner`, { headers, data: { userId: ownerId } });
    expect(restored.status()).toBe(200);
  }
});
