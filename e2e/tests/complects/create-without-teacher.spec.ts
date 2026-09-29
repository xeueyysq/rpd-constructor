import { expect, test, type Page } from '@playwright/test';
import { openComplect, signIn } from '../helpers';

test.describe('создание РПД без преподавателя', () => {
  test.describe.configure({ mode: 'serial' });

  const discipline = 'Создание без преподавателя для теста';
  const row = (page: Page) => page.getByRole('row').filter({ hasText: discipline });

  test('РОП создаёт шаблон без назначения, затем назначает преподавателя', async ({ page }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    await expect(row(page).getByRole('cell').nth(3)).toContainText('Выгружен из 1С');
    await row(page).getByRole('button', { name: 'Создать' }).click();
    await expect(row(page).getByRole('cell').nth(3)).toContainText('Создан');
    await expect(row(page).getByRole('cell').nth(2)).not.toContainText('Яковлева Тест Тестовна');

    const teachers = row(page).getByRole('combobox', { name: 'Преподаватели' });
    await teachers.fill('Яковлева');
    await page.getByRole('option', { name: /Яковлева Тест Тестовна/ }).click();
    await expect(row(page).getByRole('cell').nth(2)).toContainText('Яковлева Тест Тестовна');

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await expect(page).toHaveURL(/\/complects$/);
    await openComplect(page);
    await expect(row(page).getByRole('cell').nth(2)).toContainText('Яковлева Тест Тестовна');
    await expect(row(page).getByRole('cell').nth(3)).toContainText('Назначены преподаватели');
  });
});
