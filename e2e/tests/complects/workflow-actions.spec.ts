import { expect, test } from '@playwright/test';
import { apiUrl, disciplines, openComplect, openTeacherRowMenu, signIn } from '../helpers';
import { closeTeachersDialog, openTeachersDialog, openRowMenu, selectTeacher } from '../teacherAssignments';

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
    const teachers = await openTeachersDialog(page, row, disciplines.otherRop);
    const assignment = page.waitForResponse((response) =>
      response.url() === `${apiUrl}/api/templates/${templateId}/workflow` && response.request().method() === 'POST');
    await selectTeacher(teachers, 'Другов Тест Тестович');
    expect((await assignment).status()).toBe(200);
    assigned = true;
    await closeTeachersDialog(teachers);

    await expect(row).toContainText('Другов Тест Тестович');
    await row.getByRole('cell').nth(3).getByRole('button', { name: 'Назначены преподаватели', exact: true }).click();
    const history = page.getByRole('dialog', { name: 'История шаблона' });
    await expect(history).toContainText('Назначен преподаватель');
    await history.getByRole('button', { name: 'Закрыть', exact: true }).click();
    const actionsCell = row.getByRole('cell').nth(4);
    await expect(actionsCell.getByRole('button')).toHaveCount(1);
    const menu = await openRowMenu(page, row);
    // «Открыть» первым, затем управление РПД и действия workflow; у каждого пункта есть иконка.
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Открыть', 'Изменить преподавателей', 'Импортировать', 'История шаблона', 'Принять',
    ]);
    for (const item of await menu.getByRole('menuitem').all()) await expect(item.locator('svg')).toHaveCount(1);
    await expect(menu.getByRole('menuitem', { name: 'Принять', exact: true })).toBeVisible();
    for (const name of ['Взять в работу', 'Готово', 'Снять отметку']) {
      await expect(menu.getByRole('menuitem', { name, exact: true })).toHaveCount(0);
    }
    // Принятие, как и остальные действия комплекта, запускается из единственного меню.
    await menu.getByRole('menuitem', { name: 'Принять', exact: true }).click();
    await expect(row.getByRole('cell').nth(3)).toContainText('Готов');
    await expect(row.getByRole('cell').nth(3)).not.toContainText(/\d+\/\d+/);
    const readyMenu = await openRowMenu(page, row);
    await expect(readyMenu.getByRole('menuitem', { name: 'Вернуть на доработку', exact: true })).toBeVisible();
    await readyMenu.getByRole('menuitem', { name: 'Вернуть на доработку', exact: true }).click();
    const returnDialog = page.getByRole('dialog', { name: 'Вернуть РПД на доработку' });
    await returnDialog.getByRole('textbox', { name: 'Комментарий' }).fill('Продолжить проверку режима преподавателя');
    await returnDialog.getByRole('button', { name: 'Вернуть на доработку', exact: true }).click();
    await expect(returnDialog).toBeHidden();
    await row.getByRole('cell').nth(3).getByRole('button', { name: 'На доработке', exact: true }).click();
    await expect(history).toContainText('Продолжить проверку режима преподавателя');
    await history.getByRole('button', { name: 'Закрыть', exact: true }).click();

    await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
    await page.getByRole('menuitem', { name: 'Преподаватель', exact: true }).click();
    await expect(page).toHaveURL(/\/templates$/);

    const teacherRow = page.getByRole('row').filter({ hasText: disciplines.otherRop });
    // Как у РОП: в строке одна кнопка «…», прямых кнопок действий нет.
    await expect(teacherRow.getByRole('cell').nth(8).getByRole('button')).toHaveCount(1);
    for (const name of ['Открыть', 'Взять в работу', 'Готово', 'Принять']) {
      await expect(teacherRow.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    // История открывается по клику на статус, как у РОП; личная отметка — подтекстом.
    const teacherStatus = teacherRow.getByRole('cell').nth(7);
    await expect(teacherStatus).toContainText('Моя отметка: Назначен');
    await teacherStatus.getByRole('button', { name: 'На доработке', exact: true }).click();
    await expect(history).toContainText('Продолжить проверку режима преподавателя');
    await history.getByRole('button', { name: 'Закрыть', exact: true }).click();

    // До «Взять в работу» «Готово» недоступно.
    let teacherMenu = await openTeacherRowMenu(page, teacherRow);
    await expect(teacherMenu.getByRole('menuitem')).toHaveText(['Открыть', 'История шаблона', 'Взять в работу']);
    for (const item of await teacherMenu.getByRole('menuitem').all()) await expect(item.locator('svg')).toHaveCount(1);
    await teacherMenu.getByRole('menuitem', { name: 'Взять в работу', exact: true }).click();
    await expect(teacherStatus).toContainText('Моя отметка: В работе');

    teacherMenu = await openTeacherRowMenu(page, teacherRow);
    await expect(teacherMenu.getByRole('menuitem')).toHaveText(['Открыть', 'История шаблона', 'Готово']);
    await teacherMenu.getByRole('menuitem', { name: 'Открыть', exact: true }).click();
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
