import { expect, test } from '@playwright/test';
import { disciplines, openComplect, signIn } from '../helpers';
import { closeTeachersDialog, openRowMenu } from '../teacherAssignments';

test('диалог импорта показывает преподавателей и ищет шаблоны по ФИО', async ({ page }) => {
  await signIn(page, 'rop');
  await openComplect(page);

  const target = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await openRowMenu(page, target);
  await page.getByRole('menuitem', { name: 'Изменить преподавателей' }).click();
  const teachers = page.getByRole('dialog', { name: `Преподаватели: ${disciplines.inProgress}`, exact: true });
  const fromOneC = teachers.getByRole('list', { name: 'Из 1С', exact: true });
  const others = teachers.getByRole('list', { name: 'Остальные преподаватели', exact: true });
  await expect(fromOneC.getByRole('checkbox', { name: 'Альфина Тест Тестовна', exact: true })).toBeChecked();
  await expect(fromOneC.getByRole('checkbox')).toHaveCount(1);
  // Остальные аккаунты — во втором разделе, без пометки «из 1С» в подписи.
  await expect(others.getByRole('checkbox', { name: 'Яковлева Тест Тестовна', exact: true })).not.toBeChecked();
  await expect(others.getByRole('checkbox', { name: 'Альфина Тест Тестовна' })).toHaveCount(0);
  await expect(teachers.getByText('В 1С преподаватели не указаны')).toHaveCount(0);
  await closeTeachersDialog(teachers);
  await openRowMenu(page, target);
  await page.getByRole('menuitem', { name: 'Импортировать' }).click();

  const dialog = page.getByRole('dialog', { name: 'Импортировать данные из шаблона' });
  await dialog.getByRole('button', { name: /Синтетический профиль 2025/ }).click();
  const source = dialog.getByRole('button', { name: /Лист согласования для теста/ });
  await expect(source).toContainText('Альфина Тест Тестовна, Яковлева Тест Тестовна');

  await dialog.getByRole('textbox', { name: 'Поиск по шаблонам (дисциплина/преподаватель/семестр)' }).fill('Яковлева');
  await expect(source).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Литература для теста/ })).toHaveCount(0);
});
