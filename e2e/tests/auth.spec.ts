import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

for (const role of ['admin', 'rop', 'teacher'] as const) {
  test(`${role} входит через форму`, async ({ page }) => {
    await signIn(page, role);
    await expect(page.getByText(role === 'teacher' ? 'Выбор РПД для редактирования' : 'Список загруженных комплектов РПД')).toBeVisible();
  });
}

test('неверный пароль показывает ошибку', async ({ page }) => {
  await signIn(page, 'admin', 'wrong-password');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByText('Неверное имя или пароль')).toBeVisible();
});
