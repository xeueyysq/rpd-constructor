import { expect, type Locator, type Page } from '@playwright/test';
import { apiUrl } from './helpers';

export async function openTeachersDialog(page: Page, row: Locator, discipline: string, readOnly = false) {
  // В ячейке — кликабельное ФИО, а при пустом составе — приглашение назначить.
  await row.getByRole('cell').nth(2).getByRole('button').first().click();
  const dialog = page.getByRole('dialog', { name: `Преподаватели: ${discipline}`, exact: true });
  await expect(dialog).toBeVisible();
  if (readOnly) await expect(dialog.getByRole('checkbox').first()).toBeDisabled();
  return dialog;
}

export async function selectTeacher(dialog: Locator, fullname: string, checked = true) {
  await dialog.getByRole('textbox', { name: 'Поиск преподавателя' }).fill(fullname);
  const checkbox = dialog.getByRole('checkbox', { name: fullname });
  if ((await checkbox.isChecked()) !== checked) await checkbox.click();
  // Только локальный draft; сетевое сохранение выполняет applyTeachersDialog.
  if (checked) await expect(checkbox).toBeChecked();
  else await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
}

export async function closeTeachersDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(dialog).toBeHidden();
}

export async function applyTeachersDialog(page: Page, dialog: Locator) {
  const saved = page.waitForResponse((response) =>
    response.url().startsWith(`${apiUrl}/api/templates/`) && response.url().endsWith('/participants')
    && response.request().method() === 'PUT');
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
  expect((await saved).status(), 'Apply должен сохранить состав целиком').toBe(200);
  await expect(dialog).toBeHidden();
}

export async function assignTeacher(page: Page, row: Locator, discipline: string, fullname: string) {
  const dialog = await openTeachersDialog(page, row, discipline);
  await selectTeacher(dialog, fullname);
  await applyTeachersDialog(page, dialog);
  await expect(row.getByRole('cell').nth(2)).toContainText(fullname);
}

export async function openRowMenu(page: Page, row: Locator) {
  await row.click({ button: 'right' });
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}
