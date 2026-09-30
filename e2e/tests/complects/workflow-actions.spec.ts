import { expect, test } from '@playwright/test';
import { apiUrl, disciplines, openComplect, signIn } from '../helpers';

test('РОП видит действия активного режима и открывает свою РПД как преподаватель', async ({ page, request }) => {
  // Второй РОП и его комплект не участвуют в сценарии совместной готовности.
  const templateId = 109;
  const userId = 13;
  const login = page.waitForResponse((response) =>
    response.url() === `${apiUrl}/auth/sign-in` && response.request().method() === 'POST');
  await signIn(page, 'rop2');
  const { accessToken } = await (await login).json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  let assigned = false;

  try {
    await openComplect(page, 'other');
    const row = page.getByRole('row').filter({ hasText: disciplines.otherRop });
    await row.getByRole('combobox', { name: 'Преподаватели' }).fill('Другов');
    const assignment = page.waitForResponse((response) =>
      response.url() === `${apiUrl}/api/templates/${templateId}/workflow` && response.request().method() === 'POST');
    await page.getByRole('option', { name: 'Другов Тест Тестович' }).click();
    expect((await assignment).status()).toBe(200);
    assigned = true;

    await expect(row).toContainText('Другов Тест Тестович');
    await expect(row.getByRole('button', { name: 'Принять', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Взять в работу', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Готово', exact: true })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Другие действия РПД' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
    await page.getByRole('menuitem', { name: 'Преподаватель', exact: true }).click();
    await expect(page).toHaveURL(/\/templates$/);

    const teacherRow = page.getByRole('row').filter({ hasText: disciplines.otherRop });
    await expect(teacherRow.getByRole('button', { name: 'Взять в работу', exact: true })).toBeVisible();
    await expect(teacherRow.getByRole('button', { name: 'Принять', exact: true })).toHaveCount(0);
    await expect(teacherRow.getByRole('button', { name: 'Готово', exact: true })).toHaveCount(0);
    const openButton = teacherRow.getByRole('button', { name: 'Открыть', exact: true });
    const openBounds = await openButton.boundingBox();
    expect(openBounds).not.toBeNull();
    for (const name of ['Взять в работу', 'Другие действия РПД']) {
      const bounds = await teacherRow.getByRole('button', { name, exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.y + bounds!.height / 2).toBeCloseTo(openBounds!.y + openBounds!.height / 2, 0);
    }
    await teacherRow.getByRole('button', { name: 'Другие действия РПД' }).click();
    await expect(page.getByRole('menuitem', { name: 'Готово', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Принять', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await teacherRow.getByRole('button', { name: 'Взять в работу', exact: true }).click();
    await expect(teacherRow.getByRole('button', { name: 'Готово', exact: true })).toBeVisible();
    await expect(teacherRow.getByRole('button', { name: 'Другие действия РПД' })).toHaveCount(0);
    await expect(teacherRow.getByRole('button', { name: 'Принять', exact: true })).toHaveCount(0);
    await openButton.click();
    await expect(page).toHaveURL(/\/templates\/a109a109a109(?:\/.*)?$/);
    await expect(page.getByText('Титульный лист', { exact: true }).last()).toBeVisible();
    await expect(page.getByText(disciplines.otherRop, { exact: true }).last()).toBeVisible();
  } finally {
    if (assigned) {
      const response = await request.post(`${apiUrl}/api/templates/${templateId}/workflow`, {
        headers, data: { action: 'unassign', userId },
      });
      expect(response.status()).toBe(200);
    }
  }
});
