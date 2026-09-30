import { expect, test } from '@playwright/test';
import { disciplines, openComplect, signIn } from '../helpers';
import { closeTeachersDialog } from '../teacherAssignments';

test('диалог импорта показывает преподавателей и ищет шаблоны по ФИО', async ({ page }) => {
  await signIn(page, 'rop');
  await openComplect(page);

  const target = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await target.getByRole('button', { name: 'Меню шаблона' }).click();
  await page.getByRole('menuitem', { name: 'Изменить преподавателей' }).click();
  const teachers = page.getByRole('dialog', { name: `Преподаватели: ${disciplines.inProgress}`, exact: true });
  await expect(teachers.getByRole('checkbox', { name: 'Альфина Тест Тестовна — из 1С', exact: true })).toBeChecked();
  await expect(teachers.getByRole('checkbox').first()).toHaveAccessibleName('Альфина Тест Тестовна — из 1С');
  await closeTeachersDialog(teachers);
  await target.getByRole('button', { name: 'Меню шаблона' }).click();
  await page.getByRole('menuitem', { name: 'Импортировать' }).click();

  const dialog = page.getByRole('dialog', { name: 'Импортировать данные из шаблона' });
  await dialog.getByRole('button', { name: /Синтетический профиль 2025/ }).click();
  const source = dialog.getByRole('button', { name: /Лист согласования для теста/ });
  await expect(source).toContainText('Альфина Тест Тестовна, Яковлева Тест Тестовна');

  await dialog.getByRole('textbox', { name: 'Поиск по шаблонам (дисциплина/преподаватель/семестр)' }).fill('Яковлева');
  await expect(source).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Литература для теста/ })).toHaveCount(0);
});
