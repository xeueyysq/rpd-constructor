import { expect, test, type Page } from '@playwright/test';
import { apiUrl, disciplines, filterColumn, openComplect, signIn } from '../helpers';
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

test.describe('история шаблона', () => {
  const event = (day: number, action: string, status: string, user: string, comment?: string) => ({
    date: `2026-03-${String(day).padStart(2, '0')}T09:30:00.000Z`, action, status, user, ...(comment ? { comment } : {}),
  });
  const openHistory = async (page: Page, events: unknown[]) => {
    await page.route(`${apiUrl}/api/get-template-history`, (route) => route.fulfill({ json: events }));
    await signIn(page, 'admin');
    await openComplect(page);
    const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
    await row.getByRole('cell').nth(3).getByRole('button', { name: 'В работе', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'История шаблона' });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  test('компактный диалог: новые события сверху, комментарий отдельным блоком', async ({ page }) => {
    const comment = 'Первая строка комментария\nВторая строка';
    const dialog = await openHistory(page, [
      event(1, 'assign', 'on_teacher', 'Иванов И. И.'),
      { ...event(2, 'start', 'in_progress', 'Петров П. П.'), date: 'не дата' },
      event(3, 'refine', 'on_refinement', 'Сидоров С. С.', comment),
    ]);
    // maxWidth="sm" — не шире 600 px.
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(600);
    const events = dialog.getByRole('listitem');
    await expect(events).toHaveCount(3);
    await expect(events.nth(0)).toContainText('Возвращено на доработку');
    await expect(events.nth(0)).toContainText('На доработке');
    await expect(events.nth(0)).toContainText('3 марта 2026');
    await expect(events.nth(0)).toContainText('Сидоров С. С.');
    const commentBlock = events.nth(0).getByText('Первая строка комментария');
    await expect(commentBlock).toHaveText(comment);
    await expect(commentBlock).toHaveCSS('white-space', 'pre-wrap');
    // Повреждённая дата не роняет диалог: остаётся автор.
    await expect(events.nth(1)).toContainText('Взято в работу');
    await expect(events.nth(1)).toContainText('Петров П. П.');
    await expect(events.nth(2)).toContainText('Назначен преподаватель');
    await expect(events.nth(2)).toContainText('1 марта 2026');
    await expect(dialog.getByRole('separator')).toHaveCount(2);
  });

  test('длинная история прокручивается внутри диалога, пустая показывает подсказку', async ({ page }) => {
    const many = Array.from({ length: 40 }, (_, index) =>
      event(index % 28 + 1, 'reopen', 'in_progress', `Автор ${index + 1}`));
    const dialog = await openHistory(page, many);
    const close = dialog.getByRole('button', { name: 'Закрыть', exact: true });
    const items = dialog.getByRole('listitem');
    await expect(items).toHaveCount(40);
    await expect(items.first()).toContainText('Автор 40');
    await expect(items.first()).toBeInViewport();
    await expect(close).toBeInViewport();
    await expect(items.last()).not.toBeInViewport();
    await items.last().scrollIntoViewIfNeeded();
    await expect(items.last()).toBeInViewport();
    await expect(dialog.getByRole('heading', { name: 'История шаблона' })).toBeInViewport();
    await expect(close).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.unroute(`${apiUrl}/api/get-template-history`);
    await page.route(`${apiUrl}/api/get-template-history`, (route) => route.fulfill({ json: [] }));
    await page.getByRole('row').filter({ hasText: disciplines.inProgress })
      .getByRole('cell').nth(3).getByRole('button', { name: 'В работе', exact: true }).click();
    await expect(dialog).toContainText('История пуста');
  });
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
