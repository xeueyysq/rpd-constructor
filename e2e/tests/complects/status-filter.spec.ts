import { expect, test } from '@playwright/test';
import { disciplines, filterColumn, openComplect, signIn } from '../helpers';
import { openRowMenu } from '../teacherAssignments';

test('фильтр статуса в комплекте', async ({ page }) => {
  await signIn(page, 'admin');
  await openComplect(page);
  // MRT дописывает к заголовку счётчик сортировки («Дисциплина0»), поэтому сверяем начало текста.
  await expect(page.getByRole('columnheader')).toHaveText([
    /^Дисциплина/, /^Семестр/, /^Преподаватели/, /^Статус/, /^Действия/,
  ]);
  // У всех дисциплин, включая строки без шаблона, в действиях только одна кнопка меню.
  const rows = page.getByRole('row').filter({ has: page.getByRole('cell') });
  for (const row of await rows.all()) {
    await expect(row.getByRole('cell').nth(4).getByRole('button')).toHaveCount(1);
    await expect(row.getByRole('cell').nth(4).getByRole('button', { name: 'Меню шаблона' })).toBeVisible();
  }
  const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await expect(row.getByRole('cell').nth(2).getByRole('listitem').filter({ hasText: 'Альфина' }))
    .toHaveText('Альфина Тест ТестовнаВ работе');
  const status = row.getByRole('cell').nth(3);
  await expect(status).not.toContainText('Альфина');
  await expect(status).not.toContainText(/\d+\/\d+/);
  await expect(status).toContainText(/\d{1,2} [а-я]+ \d{4}, \d{2}:\d{2}/);
  const statusButton = status.getByRole('button', { name: 'В работе', exact: true });
  // Подпись поддерживает клавиатуру и открывает тот же диалог, что пункт меню.
  await statusButton.focus();
  await page.keyboard.press('Enter');
  const history = page.getByRole('dialog', { name: 'История шаблона' });
  await expect(history).toBeVisible();
  await expect(history).toContainText('В работе');
  await history.getByRole('button', { name: 'Закрыть', exact: true }).click();
  const menu = await openRowMenu(page, row);
  await menu.getByRole('menuitem', { name: 'История шаблона', exact: true }).click();
  await expect(history).toBeVisible();
  await expect(history).toContainText('В работе');
  await history.getByRole('button', { name: 'Закрыть', exact: true }).click();
  const unloaded = page.getByRole('row').filter({ hasText: disciplines.unloaded }).getByRole('cell').nth(3);
  await expect(unloaded.getByRole('button')).toHaveCount(0);
  await expect(unloaded).toContainText(/\d{1,2} [а-я]+ \d{4}, \d{2}:\d{2}/);

  await expect(row.getByRole('combobox', { name: 'Преподаватели' })).toHaveCount(0);
  await filterColumn(page, 'Статус', 'В работе');
  await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: disciplines.ready })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: disciplines.unloaded })).toHaveCount(0);
});

test('фильтр статуса у преподавателя', async ({ page }) => {
  await signIn(page, 'teacher');
  await expect(page.getByRole('row').filter({ hasText: disciplines.ready })).toBeVisible();
  await filterColumn(page, 'Статус', 'В работе');
  const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').nth(7)).toContainText('0/2 готовы');
  await expect(row.getByRole('cell').nth(7).getByRole('listitem').filter({ hasText: 'Альфина' })).toContainText('Альфина Тест ТестовнаВ работе');
  await expect(page.getByRole('row').filter({ hasText: disciplines.ready })).toHaveCount(0);
});
