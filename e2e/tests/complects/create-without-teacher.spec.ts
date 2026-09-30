import { expect, test, type Page } from '@playwright/test';
import { apiUrl, disciplines, openComplect, password, signIn } from '../helpers';
import { assignTeacher, closeTeachersDialog, openTeachersDialog, selectTeacher } from '../teacherAssignments';

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

    await assignTeacher(page, row(page), discipline, 'Яковлева Тест Тестовна');

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await expect(page).toHaveURL(/\/complects$/);
    await openComplect(page);
    await expect(row(page).getByRole('cell').nth(2)).toContainText('Яковлева Тест Тестовна');
    await expect(row(page).getByRole('cell').nth(3)).toContainText('Назначены преподаватели');
  });
});

test('локальный выбор из диалога уходит в Создать, длинное ФИО переносится целиком', async ({ page, request }) => {
  const auth = await request.post(`${apiUrl}/auth/sign-in`, {
    data: { userName: 'admin', password },
  });
  expect(auth.status()).toBe(200);
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken as string}` };
  const fullname = {
    surname: 'Длиннофамильная-Преподавательская-Синтетическая',
    name: 'Александрина',
    patronymic: 'Константиновна',
  };
  const name = `c3${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const created = await request.post(`${apiUrl}/api/users`, {
    headers, data: { name, password, role: 2, fullname },
  });
  expect(created.status()).toBe(201);
  const { id: userId } = await created.json() as { id: number };
  const fullNameText = Object.values(fullname).join(' ');

  try {
    await signIn(page, 'rop');
    await openComplect(page);
    const row = page.getByRole('row').filter({ hasText: disciplines.unloaded });
    await expect(row.getByRole('cell').nth(3)).toContainText('Выгружен из 1С');
    const dialog = await openTeachersDialog(page, row, disciplines.unloaded);
    const hint = dialog.getByRole('checkbox', { name: 'Яковлева Тест Тестовна — из 1С', exact: true });
    await expect(dialog.getByRole('checkbox').first()).toHaveAccessibleName('Яковлева Тест Тестовна — из 1С');
    await expect(hint).not.toBeChecked();
    await selectTeacher(dialog, 'Яковлева Тест Тестовна');
    await selectTeacher(dialog, fullNameText);
    await closeTeachersDialog(dialog);

    const teacherCell = row.getByRole('cell').nth(2);
    await expect(teacherCell).not.toContainText('в 1С:');
    await expect(teacherCell.getByRole('listitem').filter({ hasText: fullNameText })).toContainText('Назначен');
    const fullName = teacherCell.getByText(fullNameText, { exact: true });
    await expect(fullName).toBeVisible();
    const layout = await fullName.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const cell = element.closest('td')!.getBoundingClientRect();
      const lines = Array.from(range.getClientRects());
      return {
        lines: lines.length,
        insideCell: lines.every((line) => line.left >= cell.left && line.right <= cell.right
          && line.top >= cell.top && line.bottom <= cell.bottom),
      };
    });
    expect(layout.lines).toBeGreaterThan(1);
    expect(layout.insideCell).toBe(true);

    const reopened = await openTeachersDialog(page, row, disciplines.unloaded);
    await expect(reopened.getByRole('checkbox', { name: fullNameText })).toBeChecked();
    await expect(reopened.getByRole('checkbox', { name: 'Яковлева Тест Тестовна — из 1С', exact: true })).toBeChecked();
    // Удаление до создания тоже остаётся локальным.
    await selectTeacher(reopened, 'Яковлева Тест Тестовна', false);
    await closeTeachersDialog(reopened);
    await expect(teacherCell).not.toContainText('Яковлева');
    await expect(row.getByRole('cell').nth(3)).toContainText('Выгружен из 1С');

    const creation = page.waitForResponse((response) =>
      response.url() === `${apiUrl}/api/create-profile-template-from-1c` && response.request().method() === 'POST');
    await row.getByRole('button', { name: 'Создать' }).click();
    const response = await creation;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toMatchObject({ id_1c: 102, teacherIds: [userId] });
    await expect(row.getByRole('cell').nth(3)).toContainText('Назначены преподаватели');
    await expect(row.getByRole('cell').nth(3)).toContainText('0/1 готовы');

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await openComplect(page);
    await expect(teacherCell).toContainText(fullNameText);
    await expect(row.getByRole('cell').nth(3)).not.toContainText(fullNameText);

    const removal = await openTeachersDialog(page, row, disciplines.unloaded);
    await selectTeacher(removal, fullNameText, false);
    await closeTeachersDialog(removal);
    await expect(teacherCell).not.toContainText(fullNameText);
    await expect(row.getByRole('cell').nth(3)).toContainText('Создан');
    await page.reload();
    await expect(teacherCell).not.toContainText(fullNameText);
    await expect(row.getByRole('cell').nth(3)).toContainText('Создан');
  } finally {
    const deactivated = await request.patch(`${apiUrl}/api/users`, {
      headers, data: { ids: [userId], is_active: false },
    });
    expect(deactivated.status()).toBe(200);
  }
});
