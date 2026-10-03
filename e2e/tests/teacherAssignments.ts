import { expect, type Locator, type Page } from '@playwright/test';

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
  // Для созданной РПД отметка приходит после assign/unassign и обновления строки.
  if (checked) await expect(checkbox).toBeChecked();
  else await expect(checkbox).not.toBeChecked();
  await expect(checkbox).toBeEnabled();
}

export async function closeTeachersDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(dialog).toBeHidden();
}

export async function assignTeacher(page: Page, row: Locator, discipline: string, fullname: string) {
  const dialog = await openTeachersDialog(page, row, discipline);
  await selectTeacher(dialog, fullname);
  await closeTeachersDialog(dialog);
  await expect(row.getByRole('cell').nth(2)).toContainText(fullname);
}

export async function openRowMenu(page: Page, row: Locator) {
  const actions = row.getByRole('cell').nth(4);
  await expect(actions.getByRole('button')).toHaveCount(1);
  await actions.getByRole('button', { name: 'Меню шаблона', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}
