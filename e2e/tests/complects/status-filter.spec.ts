import { expect, test } from '@playwright/test';
import { disciplines, filterColumn, openComplect, signIn } from '../helpers';

test('фильтр статуса в комплекте', async ({ page }) => {
  await signIn(page, 'admin');
  await openComplect(page);
  // MRT дописывает к заголовку счётчик сортировки («Дисциплина0»), поэтому сверяем начало текста.
  await expect(page.getByRole('columnheader')).toHaveText([
    /^Дисциплина/, /^Семестр/, /^Преподаватели/, /^Статус/, /^Действия/,
  ]);
  const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await expect(row.getByRole('cell').nth(2).getByRole('listitem').filter({ hasText: 'Альфина' }))
    .toHaveText('Альфина Тест ТестовнаВ работе');
  await expect(row.getByRole('cell').nth(3)).not.toContainText('Альфина');
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
  await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: disciplines.ready })).toHaveCount(0);
});
