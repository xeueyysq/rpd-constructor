import { expect, test } from '@playwright/test';
import { signIn } from '../helpers';

const ropLabel = 'Руководитель образовательной программы';

test('меню РОП: роли, затем «Настройки» и «Выйти»; переключение ролей', async ({ page }) => {
  await signIn(page, 'rop');
  // Единственный интерактивный элемент с этим именем — без вложенной кнопки.
  const trigger = page.getByRole('button', { name: 'Открыть меню аккаунта' });
  await expect(trigger).toHaveCount(1);
  await trigger.click();

  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText([ropLabel, 'Преподаватель', 'Настройки', 'Выйти']);
  await expect(menu.getByRole('menuitem', { name: 'Настройки' })).toBeDisabled();
  // Один разделитель — между ролями и «Настройками».
  await expect(menu.getByRole('separator')).toHaveCount(1);

  // Название роли целиком помещается в меню, а меню — в окно.
  const paper = page.locator('.MuiMenu-paper');
  const paperBox = (await paper.boundingBox())!;
  const labelBox = (await menu.getByRole('menuitem', { name: ropLabel }).locator('.MuiListItemText-root').boundingBox())!;
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(paperBox.x + paperBox.width);
  expect(paperBox.x).toBeGreaterThanOrEqual(0);
  expect(paperBox.x + paperBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  await menu.getByRole('menuitem', { name: 'Преподаватель', exact: true }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(menu).toBeHidden();

  await trigger.click();
  await menu.getByRole('menuitem', { name: ropLabel }).click();
  await expect(page).toHaveURL(/\/complects$/);
  await expect(menu).toBeHidden();
});

test('меню администратора без переключателя: «Настройки», «Выйти», без разделителя', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Настройки', 'Выйти']);
  await expect(menu.getByRole('menuitem', { name: 'Настройки' })).toBeDisabled();
  await expect(menu.getByRole('separator')).toHaveCount(0);
});

test('меню аккаунта управляется с клавиатуры: Enter открывает, Escape закрывает и возвращает фокус', async ({ page }) => {
  await signIn(page, 'rop');
  const trigger = page.getByRole('button', { name: 'Открыть меню аккаунта' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.locator('[aria-label="Открыть меню аккаунта"]')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
