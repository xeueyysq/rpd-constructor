import { expect, type Locator, type Page } from '@playwright/test';

export async function openTeachersDialog(page: Page, row: Locator, discipline: string, readOnly = false) {
  await row.getByRole('button', {
    name: readOnly ? 'Просмотреть преподавателей' : 'Изменить преподавателей',
  }).click();
  const dialog = page.getByRole('dialog', { name: `Преподаватели: ${discipline}`, exact: true });
  await expect(dialog).toBeVisible();
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
