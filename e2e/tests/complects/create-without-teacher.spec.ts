import { expect, test, type Page } from '@playwright/test';
import { apiUrl, disciplines, openComplect, password, signIn } from '../helpers';
import { applyTeachersDialog, assignTeacher, closeTeachersDialog, openTeachersDialog, openRowMenu, selectTeacher } from '../teacherAssignments';
import { templateFromDb } from '../list3';

test.describe('автоматически созданная РПД без преподавателя', () => {
  test.describe.configure({ mode: 'serial' });

  const discipline = 'Создание без преподавателя для теста';
  const row = (page: Page) => page.getByRole('row').filter({ hasText: discipline });

  test('РОП сразу открывает созданную РПД и отдельно назначает преподавателя', async ({ page }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    await expect(row(page).getByRole('cell').nth(3)).toContainText('Создан');
    // Приглашение назначить подчёркнуто, как ссылка.
    const invite = row(page).getByRole('cell').nth(2).getByRole('button', { name: 'Назначить преподавателей', exact: true });
    await expect(invite.getByText('Назначить преподавателей')).toHaveCSS('text-decoration-line', 'underline');
    const assignmentMenu = await openRowMenu(page, row(page));
    await expect(assignmentMenu.getByRole('menuitem', { name: 'Создать', exact: true })).toHaveCount(0);
    await expect(assignmentMenu.getByRole('menuitem').first()).toHaveText('Открыть');
    for (const item of await assignmentMenu.getByRole('menuitem').all()) await expect(item.locator('svg')).toHaveCount(1);
    await assignmentMenu.getByRole('menuitem', { name: 'Изменить преподавателей', exact: true }).click();
    const teachers = page.getByRole('dialog', { name: `Преподаватели: ${discipline}`, exact: true });
    await expect(teachers).toBeVisible();
    // В 1С для дисциплины преподавателей нет: раздел «Из 1С» это говорит, аккаунты — в «Из системы».
    await expect(teachers.getByRole('heading', { name: 'Из 1С', exact: true })).toBeVisible();
    await expect(teachers.getByText('В 1С преподаватели не указаны')).toBeVisible();
    await expect(teachers.getByRole('list', { name: 'Из 1С', exact: true })).toHaveCount(0);
    const others = teachers.getByRole('list', { name: 'Из системы', exact: true });
    await expect(others.getByRole('checkbox', { name: 'Яковлева Тест Тестовна', exact: true })).toBeVisible();
    await expect(others.getByRole('checkbox', { name: 'Альфина Тест Тестовна', exact: true })).toBeVisible();
    await closeTeachersDialog(teachers);
    const menu = await openRowMenu(page, row(page));
    await menu.getByRole('menuitem', { name: 'Открыть', exact: true }).click();
    await expect(page).toHaveURL(/\/templates\/a113a113a113(?:\/.*)?$/);
    await expect(page.getByText(discipline, { exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await openComplect(page);
    await expect(row(page).getByRole('cell').nth(2)).not.toContainText('Яковлева Тест Тестовна');

    await assignTeacher(page, row(page), discipline, 'Яковлева Тест Тестовна');

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await expect(page).toHaveURL(/\/complects$/);
    await openComplect(page);
    await expect(row(page).getByRole('cell').nth(2)).toContainText('Яковлева Тест Тестовна');
    await expect(row(page).getByRole('cell').nth(3)).toContainText('Назначены преподаватели');
  });
});

test('draft/Apply/Cancel, длинное ФИО и повтор после задержки/ошибки сохраняют правильный состав', async ({ page, request }, testInfo) => {
  test.slow(); // Несколько реальных сохранений, reload и контролируемый ответ с ошибкой.
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
    const row = page.getByRole('row').filter({ hasText: disciplines.created });
    await expect(row.getByRole('cell').nth(3)).toContainText('Создан');
    const mutations: unknown[] = [];
    const obsoleteMutations: unknown[] = [];
    page.on('request', (sent) => {
      if (sent.method() === 'PUT' && sent.url() === `${apiUrl}/api/templates/102/participants`)
        mutations.push(sent.postDataJSON());
      if (sent.method() === 'POST' && sent.url() === `${apiUrl}/api/templates/102/workflow`)
        obsoleteMutations.push(sent.postDataJSON());
    });
    const workflow = async () => {
      const response = await request.get(`${apiUrl}/api/templates/102/workflow`, { headers });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const dialog = await openTeachersDialog(page, row, disciplines.created);
    const fromOneC = dialog.getByRole('list', { name: 'Из 1С', exact: true });
    const others = dialog.getByRole('list', { name: 'Из системы', exact: true });
    const hint = fromOneC.getByRole('checkbox', { name: 'Яковлева Тест Тестовна', exact: true });
    await expect(fromOneC.getByRole('checkbox')).toHaveCount(1);
    await expect(hint).not.toBeChecked();
    await expect(dialog.getByText('В 1С преподаватели не указаны')).toHaveCount(0);
    // Преподаватель из 1С — только в своём разделе; остальные аккаунты — в «Из системы», все по алфавиту.
    await expect(others.getByRole('checkbox', { name: 'Яковлева Тест Тестовна' })).toHaveCount(0);
    await expect(others.getByRole('checkbox', { name: 'Альфина Тест Тестовна', exact: true })).toBeVisible();
    // Поиск фильтрует оба раздела; в пустом показывается «Не найдено».
    await dialog.getByRole('textbox', { name: 'Поиск преподавателя' }).fill('Альфина');
    await expect(fromOneC).toHaveCount(0);
    await expect(dialog.getByText('Не найдено')).toHaveCount(1);
    await expect(others.getByRole('checkbox')).toHaveCount(1);
    await dialog.getByRole('textbox', { name: 'Поиск преподавателя' }).fill('');
    await selectTeacher(dialog, 'Яковлева Тест Тестовна');
    await selectTeacher(dialog, 'Яковлева Тест Тестовна', false);
    await selectTeacher(dialog, 'Яковлева Тест Тестовна');
    await selectTeacher(dialog, fullNameText);
    expect((await workflow()).participants).toEqual([]);
    expect(mutations).toEqual([]);
    expect(obsoleteMutations, 'Галочка не должна вызывать старый workflow POST').toEqual([]);
    // Отмена не отправляет запрос; при новом открытии черновик отсутствует.
    await closeTeachersDialog(dialog);
    await expect(row.getByRole('cell').nth(2)).not.toContainText(fullNameText);
    expect(mutations, 'Отмена не должна отправлять PUT').toEqual([]);
    expect(templateFromDb(102).teacher_ids).toEqual([]);
    const cancelled = await openTeachersDialog(page, row, disciplines.created);
    await expect(cancelled.getByRole('checkbox', { name: fullNameText, exact: true })).not.toBeChecked();
    await selectTeacher(cancelled, 'Яковлева Тест Тестовна');
    await selectTeacher(cancelled, fullNameText);
    await cancelled.screenshot({ path: testInfo.outputPath('teachers-draft.png') });
    await applyTeachersDialog(page, cancelled);
    expect(mutations).toEqual([{ teacherIds: [10, userId], baseTeacherIds: [] }]);
    expect((await workflow()).participants.map((item: { userId: number }) => item.userId).sort((a: number, b: number) => a - b))
      .toEqual([10, userId].sort((a, b) => a - b));
    expect(templateFromDb(102).teacher_ids).toEqual([10, userId].sort((a, b) => a - b));
    await page.reload();

    const teacherCell = row.getByRole('cell').nth(2);
    await expect(teacherCell).not.toContainText('в 1С:');
    await expect(teacherCell.getByRole('listitem').filter({ hasText: fullNameText })).toContainText('Назначен');
    const fullName = teacherCell.getByText(fullNameText, { exact: true });
    await expect(fullName).toBeVisible();
    await row.screenshot({ path: testInfo.outputPath('teachers-applied.png') });
    // Подчёркивается только приглашение, а не ФИО преподавателей.
    await expect(fullName).toHaveCSS('text-decoration-line', 'none');
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

    await expect(teacherCell).toContainText('Яковлева');
    const reopened = await openTeachersDialog(page, row, disciplines.created);
    await expect(reopened.getByRole('checkbox', { name: fullNameText })).toBeChecked();
    await expect(reopened.getByRole('list', { name: 'Из 1С', exact: true })
      .getByRole('checkbox', { name: 'Яковлева Тест Тестовна', exact: true })).toBeChecked();
    // Удаление также применяется только по Apply.
    await selectTeacher(reopened, 'Яковлева Тест Тестовна', false);
    expect((await workflow()).participants).toContainEqual(expect.objectContaining({ userId: 10 }));
    expect(templateFromDb(102).teacher_ids).toEqual([10, userId].sort((a, b) => a - b));
    await applyTeachersDialog(page, reopened);
    await expect(teacherCell).not.toContainText('Яковлева');
    await expect(row.getByRole('cell').nth(3)).toContainText('Назначены преподаватели');
    await expect(row.getByRole('cell').nth(3)).not.toContainText(/\d+\/\d+/);

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await openComplect(page);
    await expect(teacherCell).toContainText(fullNameText);
    await expect(row.getByRole('cell').nth(3)).not.toContainText(fullNameText);

    const removal = await openTeachersDialog(page, row, disciplines.created);
    await selectTeacher(removal, fullNameText, false);
    await applyTeachersDialog(page, removal);
    await expect(teacherCell).not.toContainText(fullNameText);
    await expect(row.getByRole('cell').nth(3)).toContainText('Создан');

    const retry = await openTeachersDialog(page, row, disciplines.created);
    await selectTeacher(retry, fullNameText);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`${apiUrl}/api/templates/102/participants`, async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      await held;
      await route.fulfill({ status: 500, json: { error: 'Синтетический сбой назначения' }, headers: {
        'access-control-allow-origin': new URL(page.url()).origin,
        'access-control-allow-credentials': 'true',
      } });
    });
    const sent = page.waitForRequest((item) => item.method() === 'PUT'
      && item.url() === `${apiUrl}/api/templates/102/participants`);
    const failed = page.waitForResponse((item) => item.request().method() === 'PUT'
      && item.url() === `${apiUrl}/api/templates/102/participants`);
    try {
      await retry.getByRole('button', { name: 'Применить', exact: true }).click();
      await sent;
      await expect(retry.getByRole('checkbox', { name: fullNameText })).toBeChecked();
      await expect(retry.getByRole('button', { name: 'Отмена', exact: true })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(retry).toBeVisible();
    } finally {
      release();
    }
    expect((await failed).status()).toBe(500);
    await expect(retry.getByRole('alert')).toBeVisible();
    await expect(retry.getByRole('checkbox', { name: fullNameText })).toBeChecked();
    await expect(retry.getByRole('checkbox', { name: fullNameText })).toBeEnabled();
    await expect(retry.getByRole('button', { name: 'Применить', exact: true })).toBeEnabled();
    await expect(retry.getByRole('button', { name: 'Отмена', exact: true })).toBeEnabled();
    expect((await workflow()).participants).toEqual([]);
    expect(templateFromDb(102).teacher_ids).toEqual([]);
    await page.unroute(`${apiUrl}/api/templates/102/participants`);
    await applyTeachersDialog(page, retry);
    await page.reload();
    await expect(teacherCell).toContainText(fullNameText);
    const cleanup = await openTeachersDialog(page, row, disciplines.created);
    await selectTeacher(cleanup, fullNameText, false);
    await applyTeachersDialog(page, cleanup);
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
