import { expect, test } from '@playwright/test';
import { disciplines, filterColumn, openComplect, signIn } from './helpers';

test('фильтр статуса в комплекте', async ({ page }) => {
  await signIn(page, 'admin');
  await openComplect(page);
  await filterColumn(page, 'Статус', 'Взят в работу');
  await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: disciplines.ready })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: disciplines.unloaded })).toHaveCount(0);
});

test('фильтр статуса у преподавателя', async ({ page }) => {
  await signIn(page, 'teacher');
  await expect(page.getByRole('row').filter({ hasText: disciplines.ready })).toBeVisible();
  await filterColumn(page, 'Статус', 'Взят в работу');
  await expect(page.getByRole('row').filter({ hasText: disciplines.inProgress })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: disciplines.ready })).toHaveCount(0);
});
