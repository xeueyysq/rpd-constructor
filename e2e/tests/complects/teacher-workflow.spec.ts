import { expect, test, type Page } from '@playwright/test';
import { disciplines, openComplect, showAllRows, signIn, signInWithCredentials, password } from '../helpers';

test.describe('состав и готовность отдельной РПД', () => {
  test.describe.configure({ mode: 'serial' });

  const discipline = disciplines.workflow;
  const row = (page: Page) => page.getByRole('row').filter({ hasText: discipline });
  const complectStatus = (page: Page) => row(page).getByRole('cell').nth(3);
  const teacherStatus = (page: Page) => row(page).getByRole('cell').nth(7);

  async function assign(page: Page, surname: string) {
    const teachers = row(page).getByRole('combobox', { name: 'Преподаватели' });
    await teachers.fill(surname);
    await page.getByRole('option', { name: new RegExp(surname) }).click();
    await expect(row(page)).toContainText(surname);
  }

  test('назначение двух преподавателей сохраняется после повторного открытия комплекта', async ({ page }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    await assign(page, 'Альфина');
    await assign(page, 'Яковлева');
    await expect(complectStatus(page)).toContainText('Назначены преподаватели');
    await expect(complectStatus(page)).toContainText('0/2');

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await expect(page).toHaveURL(/\/complects$/);
    await openComplect(page);
    await expect(row(page).getByRole('combobox', { name: 'Преподаватели' })).toBeVisible();
    await expect(row(page)).toContainText('Альфина Тест Тестовна');
    await expect(row(page)).toContainText('Яковлева Тест Тестовна');
    await expect(complectStatus(page)).toContainText('0/2');
  });

  test('отметка первого не делает РПД готовой, отметка второго делает', async ({ page, browser }) => {
    await signIn(page, 'teacher');
    await row(page).getByRole('button', { name: 'Готово' }).click();
    await expect(teacherStatus(page)).toContainText('В работе');
    await expect(teacherStatus(page)).toContainText('1/2');
    await expect(row(page).getByRole('cell').nth(8)).toHaveText('Готово');

    const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const secondPage = await secondContext.newPage();
      await signIn(secondPage, 'teacher2');
      await expect(row(secondPage).getByRole('cell').nth(8)).toHaveText('Назначен');
      await row(secondPage).getByRole('button', { name: 'Готово' }).click();
      await expect(teacherStatus(secondPage)).toContainText('Готов');
      await expect(teacherStatus(secondPage)).toContainText('2/2');
    } finally {
      await secondContext.close();
    }
  });

  test('в ready состав закрыт; возврат с комментарием сбрасывает отметки и допускает третьего', async ({ page, browser }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    await expect(complectStatus(page)).toContainText('Готов');
    await expect(row(page).getByRole('combobox', { name: 'Преподаватели' })).toBeDisabled();
    await row(page).getByRole('button', { name: 'Вернуть на доработку' }).click();
    const dialog = page.getByRole('dialog', { name: 'Вернуть РПД на доработку' });
    await dialog.getByRole('textbox', { name: 'Комментарий' }).fill('Уточнить разделы РПД');
    await dialog.getByRole('button', { name: 'Вернуть на доработку' }).click();
    await expect(dialog).toBeHidden();
    await expect(complectStatus(page)).toContainText('На доработке');
    await expect(complectStatus(page)).toContainText('0/2');
    await assign(page, 'Третьева');
    await expect(complectStatus(page)).toContainText('0/3');

    const thirdContext = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const thirdPage = await thirdContext.newPage();
      await signIn(thirdPage, 'teacher3');
      await expect(row(thirdPage)).toBeVisible();
      await expect(row(thirdPage).getByRole('cell').nth(8)).toHaveText('Назначен');
      await expect(teacherStatus(thirdPage)).toContainText('0/3');
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
      await expect(ropRow).toContainText('Отключева Тест Тестовна (неактивен)');
      await expect(ropRow.getByRole('cell').nth(3)).toContainText('0/1');

      const teacherPage = await teacherContext.newPage();
      await signIn(teacherPage, 'teacher2');
      const teacherRow = teacherPage.getByRole('row').filter({ hasText: disciplines.deactivation });
      await teacherRow.getByRole('button', { name: 'Готово' }).click();
      await expect(teacherRow.getByRole('cell').nth(7)).toContainText('Готов');
      await expect(teacherRow.getByRole('cell').nth(7)).toContainText('1/1');

      await ropPage.getByRole('button', { name: 'Конструктор РПД' }).click();
      await openComplect(ropPage);
      await expect(ropRow).toContainText('Отключева Тест Тестовна (неактивен)');
      await expect(ropRow.getByRole('cell').nth(3)).toContainText('Готов');
      await expect(ropRow.getByRole('cell').nth(3)).toContainText('1/1');
    } finally {
      await ropContext.close();
      await teacherContext.close();
      await inactiveContext.close();
    }
  });
});

test.describe('изменения 1С на отдельной РПД', () => {
  test.describe.configure({ mode: 'serial' });

  test('бейдж у in_progress исчезает после Просмотрено без смены этапа', async ({ page }) => {
    await signIn(page, 'rop');
    await openComplect(page);
    const row = page.getByRole('row').filter({ hasText: disciplines.sync });
    await expect(row.getByRole('cell').nth(3)).toContainText('В работе');
    await row.getByRole('button', { name: 'Изменения 1С: строка 107' }).click();
    const dialog = page.getByRole('dialog', { name: 'Изменения из 1С' });
    await expect(dialog).toContainText('4');
    await dialog.getByRole('button', { name: 'Просмотрено' }).click();
    await expect(dialog).toBeHidden();
    await expect(row.getByRole('button', { name: 'Изменения 1С: строка 107' })).toHaveCount(0);
    await expect(row.getByRole('cell').nth(3)).toContainText('В работе');

    await page.getByRole('button', { name: 'Конструктор РПД' }).click();
    await openComplect(page);
    await expect(row.getByRole('button', { name: 'Изменения 1С: строка 107' })).toHaveCount(0);
    await expect(row.getByRole('cell').nth(3)).toContainText('В работе');
  });
});

test('второй РОП открывает через UI только свой комплект', async ({ page }) => {
  await signIn(page, 'rop2');
  await expect(page.getByRole('cell', { name: 'Синтетический профиль', exact: true })).toHaveCount(0);
  await openComplect(page, 'other');
  await expect(page.getByRole('row').filter({ hasText: disciplines.otherRop })).toBeVisible();
});
