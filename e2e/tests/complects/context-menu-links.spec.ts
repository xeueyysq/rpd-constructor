import { expect, test } from '@playwright/test';
import { complects, disciplines, openComplect, signIn } from '../helpers';
import { openRowMenu } from '../teacherAssignments';

test('профиль и дисциплина — ссылки; клавиатура и ПКМ открывают действия без отдельной колонки', async ({ page, context }) => {
  await signIn(page, 'rop');
  await expect(page.getByText('Список компетенций', { exact: true })).toHaveCount(0);
  await page.goto('/planned-results');
  await expect(page).toHaveURL(/\/complects$/);
  const profile = page.getByRole('link', { name: complects.main.profile, exact: true });
  await expect(profile).toHaveAttribute('href', `/complects/${complects.main.uuid}`);
  await expect(profile).toHaveCSS('text-decoration-line', 'underline');
  await expect(page.getByRole('button', { name: 'Комплект РПД', exact: true })).toHaveCount(0);
  const [newTab] = await Promise.all([context.waitForEvent('page'), profile.click({ modifiers: ['ControlOrMeta'] })]);
  await expect(newTab).toHaveURL(new RegExp(`/complects/${complects.main.uuid}$`));
  await newTab.close();
  await openComplect(page);
  await expect(page.getByRole('columnheader', { name: /^Действия/ })).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  const link = row.getByRole('link', { name: disciplines.inProgress, exact: true });
  await expect(link).toHaveAttribute('href', /\/templates\/[a-z0-9]+\/coverPage$/);
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
  for (const key of ['Shift+F10', 'ContextMenu']) {
    await row.focus();
    await page.keyboard.press(key);
    await expect(page.getByRole('menuitem', { name: 'История шаблона', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(row).toBeFocused();
  }
  const menu = await openRowMenu(page, row);
  await menu.getByRole('menuitem', { name: 'Импортировать', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Импортировать данные РПД', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('menu')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(row).toBeFocused();
  const ready = await openRowMenu(page, page.getByRole('row').filter({ hasText: disciplines.ready }));
  await expect(ready.getByRole('menuitem', { name: 'Импортировать', exact: true })).toHaveCount(0);
  await expect(ready.getByRole('menuitem', { name: 'Открыть', exact: true })).toBeVisible();
});

test('touch hold открывает меню; движение и прокрутка отменяют hold без перехода по ссылке', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, hasTouch: true, viewport: { width: 390, height: 640 } });
  try {
    const page = await context.newPage();
    await signIn(page, 'rop');
    await page.getByRole('button', { name: 'toggle drawer', exact: true }).click();
    await openComplect(page);
    const link = page.getByRole('link', { name: disciplines.inProgress, exact: true });
    await link.scrollIntoViewIfNeeded();
    const box = (await link.boundingBox())!;
    let point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await context.newCDPSession(page);
    const start = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    const end = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    for (const cancel of ['move', 'scroll']) {
      await link.scrollIntoViewIfNeeded();
      const currentBox = (await link.boundingBox())!;
      point = { x: currentBox.x + currentBox.width / 2, y: currentBox.y + currentBox.height / 2 };
      await start();
      if (cancel === 'move') await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, x: point.x + 20 }] });
      else {
        const position = await link.evaluate((element) => {
          let scroll: HTMLElement | null = element.parentElement;
          while (scroll && (scroll.scrollHeight <= scroll.clientHeight || !/(auto|scroll)/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
          scroll ??= document.scrollingElement as HTMLElement;
          const before = scroll.scrollTop;
          scroll.scrollTop += before < scroll.scrollHeight - scroll.clientHeight ? 32 : -32;
          return { before, after: scroll.scrollTop };
        });
        expect(position.after, 'Проверяем реальную прокрутку, которая отменяет hold').not.toBe(position.before);
      }
      await page.waitForTimeout(700); // Пересекаем порог настоящего hold, иначе отмена не проверяется.
      await end();
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/complects/${complects.main.uuid}$`));
    }
    await link.scrollIntoViewIfNeeded();
    const heldBox = (await link.boundingBox())!;
    point = { x: heldBox.x + heldBox.width / 2, y: heldBox.y + heldBox.height / 2 };
    await start();
    await expect(page.getByRole('menuitem', { name: 'Открыть', exact: true })).toBeVisible();
    await end();
    await expect(page).toHaveURL(new RegExp(`/complects/${complects.main.uuid}$`));
    await page.keyboard.press('Escape');
  } finally { await context.close(); }
});
