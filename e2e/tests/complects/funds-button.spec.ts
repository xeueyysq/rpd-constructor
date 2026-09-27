import { expect, test } from '@playwright/test';
import { openComplect, signIn } from '../helpers';

test('кнопка ФОС находится в комплекте и открывает компетенцию', async ({ page }) => {
  await signIn(page, 'admin');
  await expect(page.getByRole('button', { name: 'Собрать ФОСы' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Добавить содержание рпд' })).toHaveCount(0);
  await openComplect(page);
  await expect(page.getByRole('button', { name: 'Добавить содержание рпд' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Собрать ФОСы' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сформировать ФОС' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Компетенция' })).toContainText('ТЕСТ-1 Анализировать учебные данные');
});
