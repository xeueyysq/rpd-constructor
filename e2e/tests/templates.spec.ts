import { expect, test } from '@playwright/test';
import { disciplines, openComplect, signIn } from './helpers';

test('преподаватель открывает шаблон и возвращается к списку через меню', async ({ page }) => {
  await signIn(page, 'teacher');
  const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await row.getByRole('button', { name: 'Открыть' }).click();
  await expect(page.getByText('Титульный лист', { exact: true }).last()).toBeVisible();
  await expect(page.getByText(disciplines.inProgress, { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Список РПД' }).click();
  await expect(page).toHaveURL(/\/templates$/);
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
