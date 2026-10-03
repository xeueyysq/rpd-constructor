import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  apiUrl, disciplines, openComplect, openTeacherRowMenu, showAllRows, signIn, signInWithCredentials, password,
} from '../helpers';
import { assignTeacher, closeTeachersDialog, openTeachersDialog, openRowMenu } from '../teacherAssignments';

test.describe('состав и готовность отдельной РПД', () => {
  test.describe.configure({ mode: 'serial' });

  const discipline = disciplines.workflow;
  const row = (page: Page) => page.getByRole('row').filter({ hasText: discipline });
  const complectStatus = (page: Page) => row(page).getByRole('cell').nth(3);
  const teacherStatus = (page: Page) => row(page).getByRole('cell').nth(7);

  async function assign(page: Page, surname: string) {
    await assignTeacher(page, row(page), discipline, `${surname} Тест Тестовна`);
  }

  test('назначение двух преподавателей сохраняется после повторного открытия комплекта', async ({ page }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    await assign(page, 'Альфина');
    await assign(page, 'Яковлева');
    await expect(complectStatus(page)).toContainText('Назначены преподаватели');
    await expect(complectStatus(page)).not.toContainText(/\d+\/\d+/);
    await expect(row(page).getByRole('cell').nth(2).getByRole('button')).toHaveCount(2);
    const participants = row(page).getByRole('cell').nth(2).getByRole('listitem');
    await expect(participants).toHaveText([
      'Альфина Тест ТестовнаНазначен',
      'Яковлева Тест ТестовнаНазначен',
    ]);
    await expect(complectStatus(page)).not.toContainText('Альфина');
    await expect(complectStatus(page)).not.toContainText('Яковлева');
    await expect(complectStatus(page).getByRole('listitem')).toHaveCount(0);
    await expect(row(page).getByRole('cell').nth(2)).not.toContainText('в 1С:');

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await expect(page).toHaveURL(/\/complects$/);
    await openComplect(page);
    await expect(row(page).getByRole('button', { name: 'Альфина Тест Тестовна', exact: true })).toBeVisible();
    await expect(row(page)).toContainText('Альфина Тест Тестовна');
    await expect(row(page)).toContainText('Яковлева Тест Тестовна');
    await expect(complectStatus(page)).not.toContainText(/\d+\/\d+/);
  });

  test('отметка первого не делает РПД готовой, отметка второго делает', async ({ page, browser }) => {
    await signIn(page, 'teacher');
    // Как у РОП: один общий статус с датой, личная отметка — подтекстом; прогресса и состава нет.
    await expect(teacherStatus(page)).toContainText('Назначены преподаватели');
    await expect(teacherStatus(page)).toContainText('Моя отметка: Назначен');
    await expect(teacherStatus(page)).not.toContainText(/\d+\/\d+/);
    await expect(teacherStatus(page).getByRole('listitem')).toHaveCount(0);
    await expect(row(page).getByRole('cell').nth(8).getByRole('button')).toHaveCount(1);
    await expect(row(page).getByRole('button', { name: 'Взять в работу' })).toHaveCount(0);

    // До «Взять в работу» «Готово» недоступно; все действия — в меню «…», «Открыть» первым.
    let menu = await openTeacherRowMenu(page, row(page));
    await expect(menu.getByRole('menuitem')).toHaveText(['Открыть', 'История шаблона', 'Взять в работу']);
    for (const item of await menu.getByRole('menuitem').all()) await expect(item.locator('svg')).toHaveCount(1);
    await menu.getByRole('menuitem', { name: 'Взять в работу', exact: true }).click();
    await expect(teacherStatus(page)).toContainText('Моя отметка: В работе');
    await expect(teacherStatus(page).getByRole('button', { name: 'В работе', exact: true })).toBeVisible();

    menu = await openTeacherRowMenu(page, row(page));
    await expect(menu.getByRole('menuitem')).toHaveText(['Открыть', 'История шаблона', 'Готово']);
    await menu.getByRole('menuitem', { name: 'Готово', exact: true }).click();
    await expect(teacherStatus(page)).toContainText('Моя отметка: Готово');
    // Отметка одного участника общий статус не меняет и прогресс не показывает.
    await expect(teacherStatus(page).getByRole('button', { name: 'В работе', exact: true })).toBeVisible();
    await expect(teacherStatus(page)).not.toContainText(/\d+\/\d+/);
    menu = await openTeacherRowMenu(page, row(page));
    await expect(menu.getByRole('menuitem')).toHaveText(['Открыть', 'История шаблона', 'Снять отметку']);
    await page.keyboard.press('Escape');

    // История по клику на статус: новые события сверху.
    await teacherStatus(page).getByRole('button').click();
    const history = page.getByRole('dialog', { name: 'История шаблона' });
    const events = history.getByRole('listitem');
    await expect(events.first()).toContainText('Готово');
    await expect(events.nth(1)).toContainText('Взято в работу');
    await expect(events.nth(2)).toContainText('Назначен преподаватель');
    await expect(events.nth(3)).toContainText('Назначен преподаватель');
    await history.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(history).toBeHidden();

    const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const secondPage = await secondContext.newPage();
      await signIn(secondPage, 'teacher2');
      await expect(teacherStatus(secondPage)).toContainText('Моя отметка: Назначен');
      menu = await openTeacherRowMenu(secondPage, row(secondPage));
      await expect(menu.getByRole('menuitem', { name: 'Готово', exact: true })).toHaveCount(0);
      await menu.getByRole('menuitem', { name: 'Взять в работу', exact: true }).click();
      await expect(teacherStatus(secondPage)).toContainText('Моя отметка: В работе');
      menu = await openTeacherRowMenu(secondPage, row(secondPage));
      await menu.getByRole('menuitem', { name: 'Готово', exact: true }).click();
      await expect(teacherStatus(secondPage).getByRole('button', { name: 'Готов', exact: true })).toBeVisible();
      await expect(teacherStatus(secondPage)).toContainText('Моя отметка: Готово');
      // В статусе «Готов» меню остаётся: только «Открыть» и «История шаблона».
      menu = await openTeacherRowMenu(secondPage, row(secondPage));
      await expect(menu.getByRole('menuitem')).toHaveText(['Открыть', 'История шаблона']);
    } finally {
      await secondContext.close();
    }
  });

  test('в ready состав закрыт; возврат с комментарием сбрасывает отметки и допускает третьего', async ({ page, browser }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    await expect(complectStatus(page)).toContainText('Готов');
    await expect(row(page).getByRole('cell').nth(2).getByRole('listitem')).toHaveText([
      'Альфина Тест ТестовнаГотово',
      'Яковлева Тест ТестовнаГотово',
    ]);
    await expect(row(page).getByRole('button', { name: 'Изменить преподавателей' })).toHaveCount(0);
    const teachersDialog = await openTeachersDialog(page, row(page), discipline, true);
    await expect(teachersDialog).toContainText('Чтобы изменить состав, верните РПД на доработку');
    const choices = teachersDialog.getByRole('checkbox');
    await expect(choices.first()).toBeVisible();
    for (const choice of await choices.all()) await expect(choice).toBeDisabled();
    await closeTeachersDialog(teachersDialog);
    const menu = await openRowMenu(page, row(page));
    await expect(menu.getByRole('menuitem', { name: 'Изменить преподавателей' })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Вернуть на доработку', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Вернуть РПД на доработку' });
    await expect(dialog.getByRole('button', { name: 'Вернуть на доработку' })).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Комментарий' }).fill('   ');
    await expect(dialog.getByRole('button', { name: 'Вернуть на доработку' })).toBeDisabled();
    await dialog.getByRole('textbox', { name: 'Комментарий' }).fill('  Уточнить разделы РПД  ');
    let release!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/api/templates/*/workflow', async (route) => {
      if (route.request().postDataJSON()?.action === 'refine') await hold;
      await route.continue();
    });
    const refinement = page.waitForRequest((request) =>
      request.url().startsWith(`${apiUrl}/api/templates/`) && request.url().endsWith('/workflow')
      && request.method() === 'POST' && request.postDataJSON().action === 'refine');
    try {
      await dialog.getByRole('button', { name: 'Вернуть на доработку' }).click();
      expect((await refinement).postDataJSON().comment).toBe('Уточнить разделы РПД');
      await expect(dialog.getByRole('textbox', { name: 'Комментарий' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Отмена' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Вернуть на доработку' })).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
    } finally {
      release();
    }
    await expect(dialog).toBeHidden();
    await expect(complectStatus(page)).toContainText('На доработке');
    await expect(complectStatus(page)).not.toContainText(/\d+\/\d+/);
    await assign(page, 'Третьева');
    await expect(complectStatus(page)).not.toContainText(/\d+\/\d+/);

    const thirdContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const thirdPage = await thirdContext.newPage();
      await signIn(thirdPage, 'teacher3');
      await expect(row(thirdPage)).toBeVisible();
      await expect(teacherStatus(thirdPage)).toContainText('Моя отметка: Назначен');
      await expect(teacherStatus(thirdPage).getByRole('button', { name: 'На доработке', exact: true })).toBeVisible();
    } finally {
      await thirdContext.close();
    }
  });
});

test.describe('деактивация назначенного преподавателя', () => {
  test.describe.configure({ mode: 'serial' });

  test('привязка остаётся, а готовность считают по активным', async ({ page, browser }) => {
    await signIn(page, 'admin');
    await page.getByText('Пользователи', { exact: true }).click();
    await showAllRows(page);
    const userRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'teacher4', exact: true }) });
    await userRow.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Деактивировать (1)' }).click();
    await page.getByRole('dialog', { name: 'Деактивация пользователей' })
      .getByRole('button', { name: 'Деактивировать' }).click();
    await expect(userRow).toContainText('Деактивирован');

    const ropContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const teacherContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    const inactiveContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const inactivePage = await inactiveContext.newPage();
      await signInWithCredentials(inactivePage, 'teacher4', password);
      await expect(inactivePage).toHaveURL(/\/sign-in$/);
      await expect(inactivePage.getByText('Пользователь деактивирован')).toBeVisible();

      const ropPage = await ropContext.newPage();
      await signIn(ropPage, 'rop');
      await openComplect(ropPage);
      const ropRow = ropPage.getByRole('row').filter({ hasText: disciplines.deactivation });
      await expect(ropRow).toContainText('Отключева Тест Тестовна');
      await expect(ropRow.getByRole('cell').nth(2).getByRole('listitem').filter({ hasText: 'Отключева' }))
        .toHaveText('Отключева Тест ТестовнаНазначен (неактивен)');
      await expect(ropRow.getByRole('cell').nth(3)).not.toContainText('Отключева');
      await expect(ropRow.getByRole('cell').nth(3)).not.toContainText(/\d+\/\d+/);

      const teacherPage = await teacherContext.newPage();
      await signIn(teacherPage, 'teacher2');
      const teacherRow = teacherPage.getByRole('row').filter({ hasText: disciplines.deactivation });
      const teacherStatusCell = teacherRow.getByRole('cell').nth(7);
      let menu = await openTeacherRowMenu(teacherPage, teacherRow);
      await expect(menu.getByRole('menuitem', { name: 'Готово', exact: true })).toHaveCount(0);
      await menu.getByRole('menuitem', { name: 'Взять в работу', exact: true }).click();
      await expect(teacherStatusCell).toContainText('Моя отметка: В работе');
      menu = await openTeacherRowMenu(teacherPage, teacherRow);
      await menu.getByRole('menuitem', { name: 'Готово', exact: true }).click();
      await expect(teacherStatusCell.getByRole('button', { name: 'Готов', exact: true })).toBeVisible();
      await expect(teacherStatusCell).toContainText('Моя отметка: Готово');

      await ropPage.getByRole('button', { name: 'Конструктор РПД' }).click();
      await openComplect(ropPage);
      await expect(ropRow).toContainText('Отключева Тест Тестовна');
      await expect(ropRow.getByRole('cell').nth(3)).toContainText('Готов');
      await expect(ropRow.getByRole('cell').nth(3)).not.toContainText(/\d+\/\d+/);
    } finally {
      await ropContext.close();
      await teacherContext.close();
      await inactiveContext.close();
    }
  });
});

// Последняя группа синхронизации строки 107 из seed: таблица «Поле / Было / Стало».
async function expectExchangeChanges(dialog: Locator) {
  await expect(dialog.getByRole('columnheader')).toHaveText(['Поле', 'Было', 'Стало']);
  await expect(dialog.getByRole('row').filter({ hasText: 'ЗЕТ' }).getByRole('cell')).toHaveText(['ЗЕТ', '3', '4']);
  await expect(dialog.getByRole('row').filter({ hasText: 'Преподаватели' }).getByRole('cell'))
    .toHaveText(['Преподаватели', '—', 'Третьева Тест Тестовна']);
  await expect(dialog.getByRole('row')).toHaveCount(3);
}

test.describe('изменения 1С на отдельной РПД', () => {
  test.describe.configure({ mode: 'serial' });

  test('последняя синхронизация остаётся после закрытия диалога и перезагрузки', async ({ page }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    const row = page.getByRole('row').filter({ hasText: disciplines.sync });
    await expect(row.getByRole('cell').nth(3)).toContainText('В работе');
    const status = row.getByRole('cell').nth(3);
    const changes = status.getByRole('button', { name: 'Изменения 1С: строка 107' });
    await expect(changes).toContainText('Обновлено из 1С');
    await expect(changes).toContainText('2 февраля 2025');
    await expect(changes).toContainText(/\d{2}:\d{2}/);
    await expect(row.getByRole('cell').nth(2)).not.toContainText('Обновлено из 1С');
    await changes.click();
    const dialog = page.getByRole('dialog', { name: 'Изменения из 1С' });
    await expectExchangeChanges(dialog);
    await expect(dialog.getByRole('button', { name: 'Просмотрено' })).toHaveCount(0);
    await expect(dialog.getByRole('button')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(changes).toBeVisible();
    await expect(row.getByRole('cell').nth(3)).toContainText('В работе');

    await page.reload();
    await expect(changes).toBeVisible();
    await changes.click();
    await expectExchangeChanges(dialog);
    await expect(dialog.getByRole('button', { name: 'Просмотрено' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(row.getByRole('cell').nth(3)).toContainText('В работе');
    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    const complect = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Синтетический профиль', exact: true }) });
    await expect(complect).toContainText('Обновлён');
    await expect(complect).toContainText('2 февраля 2025');
  });
});

test('второй РОП открывает через UI только свой комплект', async ({ page }) => {
  await signIn(page, 'rop2');
  await expect(page.getByRole('cell', { name: 'Синтетический профиль', exact: true })).toHaveCount(0);
  await openComplect(page, 'other');
  await expect(page.getByRole('row').filter({ hasText: disciplines.otherRop })).toBeVisible();
});
