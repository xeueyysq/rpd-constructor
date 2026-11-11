import { expect, test, type Locator, type Page } from '@playwright/test';
import { disciplines, openComplect, openTemplateFromTeacherList, signIn } from '../helpers';

// Минимальный зазор между правым краем иконки и началом текста пункта.
const minGap = 8;

async function expectIconGap(item: Locator) {
  const icon = await item.locator('svg').first().boundingBox();
  const text = await item.locator('.MuiListItemText-root').boundingBox();
  expect(icon).not.toBeNull();
  expect(text).not.toBeNull();
  expect(text!.x - (icon!.x + icon!.width)).toBeGreaterThanOrEqual(minGap);
}

async function expectMainPanelGaps(page: Page, itemsCount: number) {
  const items = page.locator('.MuiDrawer-paper').getByRole('button');
  await expect(items).toHaveCount(itemsCount);
  for (const item of await items.all()) await expectIconGap(item);
}

async function expectEditorPanel(page: Page, bottomActions: string[]) {
  const panel = page.getByRole('navigation', { name: 'Разделы РПД' });
  for (const name of bottomActions) await expectIconGap(panel.getByRole('button', { name }));

  // Между точкой и текстом каждого раздела есть зазор, а названия начинаются на одной вертикали.
  const sections = panel.getByRole('list').first().getByRole('button');
  await expect(sections).not.toHaveCount(0);
  const lefts: number[] = [];
  for (const section of await sections.all()) {
    await expect(section.locator('svg')).toHaveCount(1);
    await expectIconGap(section);
    lefts.push((await section.locator('.MuiListItemText-root').boundingBox())!.x);
  }
  expect(new Set(lefts).size).toBe(1);
}

test('главная панель admin: между иконкой и текстом есть зазор', async ({ page }) => {
  await signIn(page, 'admin');
  await expectMainPanelGaps(page, 6);
});

test('главная панель rop: между иконкой и текстом есть зазор', async ({ page }) => {
  await signIn(page, 'rop');
  await expectMainPanelGaps(page, 5);
});

test('главная панель teacher: между иконкой и текстом есть зазор', async ({ page }) => {
  await signIn(page, 'teacher');
  await expectMainPanelGaps(page, 4);
});

test('таблица комплекта: интервалы между преподавателями и под статусом равны 8 px', async ({ page }) => {
  await signIn(page, 'rop');
  await openComplect(page);
  const teachers = page.getByRole('row').filter({ hasText: disciplines.inProgress })
    .getByRole('cell').nth(2).getByRole('listitem');
  await expect(teachers).toHaveCount(2);
  await expect(teachers.nth(1)).toHaveCSS('margin-top', '8px');
  const changes = page.getByRole('row').filter({ hasText: disciplines.sync })
    .getByRole('button', { name: 'Изменения 1С: строка 107' });
  await expect(changes).toBeVisible();
  await expect(changes.locator('..')).toHaveCSS('margin-top', '8px');
});

test('панель редактора у rop: зазор у нижних действий и точек разделов', async ({ page }) => {
  await signIn(page, 'rop');
  await openComplect(page);
  await page.getByRole('row').filter({ hasText: disciplines.inProgress })
    .getByRole('button', { name: 'Меню шаблона' }).click();
  await page.getByRole('menuitem', { name: 'Открыть', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Титульный лист' })).toBeVisible();
  await expectEditorPanel(page, ['Сформировать документ', 'Список РПД']);
});

test('панель редактора у teacher: зазор у нижнего действия и точек разделов', async ({ page }) => {
  await signIn(page, 'teacher');
  await openTemplateFromTeacherList(page, page.getByRole('row').filter({ hasText: disciplines.inProgress }));
  await expect(page.getByRole('button', { name: 'Титульный лист' })).toBeVisible();
  await expectEditorPanel(page, ['Список РПД']);
});
