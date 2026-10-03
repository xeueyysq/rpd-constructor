import { mkdirSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { expect, test, type ElementHandle, type Locator, type Page } from '@playwright/test';
import { complects, disciplines, openComplect, openTemplateFromTeacherList, showAllRows, signIn } from '../helpers';
import { closeTeachersDialog, openTeachersDialog } from '../teacherAssignments';

test.use({ viewport: { width: 1280, height: 800 } });

const mediaDir = fileURLToPath(new URL('../../../rpd-client-ts/public/docs/media/', import.meta.url));
const clientUrl = parseEnv(readFileSync(new URL('../../e2e.env', import.meta.url), 'utf8')).CLIENT_URL!;

type Placement = 'right' | 'left' | 'top' | 'bottom';
type Step = { target: Locator; label: string; avoid?: Locator[]; placement?: Placement };
type Rect = { x: number; y: number; width: number; height: number };

async function annotate(page: Page, frameName: string, steps: Step[]) {
  const boxes: Array<Rect & { label: string; placement?: Placement }> = [];
  const targets: ElementHandle[] = [];
  const avoidBoxes: Rect[] = [];
  for (const step of steps) {
    await expect(step.target).toBeVisible();
    const target = await step.target.elementHandle();
    const box = await target?.boundingBox();
    if (!target || !box) throw new Error(`Не найдены координаты цели: ${step.label}`);
    targets.push(target);
    boxes.push({ ...box, label: step.label, placement: step.placement });
    for (const locator of step.avoid ?? []) {
      await expect(locator).toBeVisible();
      const avoidBox = await locator.boundingBox();
      if (!avoidBox) throw new Error(`Не найдены координаты препятствия: ${step.label}`);
      avoidBoxes.push(avoidBox);
    }
  }

  const warnings = await page.evaluate(({ items, avoid, targets }) => {
    document.getElementById('docs-annotations')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'docs-annotations';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:2147483647;pointer-events:none;font-family:Arial,sans-serif';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(document.documentElement.scrollWidth));
    svg.setAttribute('height', String(document.documentElement.scrollHeight));
    svg.style.cssText = 'position:absolute;inset:0;overflow:visible';
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'docs-arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrow.setAttribute('fill', '#ae2828');
    marker.appendChild(arrow);
    defs.appendChild(marker);
    svg.appendChild(defs);
    overlay.appendChild(svg);
    document.body.appendChild(overlay);

    const viewport = {
      x: window.scrollX + 8,
      y: window.scrollY + 8,
      width: window.innerWidth - 16,
      height: window.innerHeight - 16,
    };
    const toPageRect = (box: Rect): Rect => ({
      x: box.x + window.scrollX,
      y: box.y + window.scrollY,
      width: box.width,
      height: box.height,
    });
    const frames = items.map((item) => {
      const box = toPageRect(item);
      return { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 };
    });
    const blocked: Rect[] = [...frames, ...avoid.map((box) => toPageRect(box))];
    const obstacles = [...document.querySelectorAll<HTMLElement>('button, a, input, textarea, select, [role=button], [role=combobox], [role=menuitem], [role=tab], [role=option], label, h1, h2, h3, h4, h5, h6, p, th')]
      .filter((element) => element.checkVisibility({ checkOpacity: true }) &&
        targets.every((target) => element !== target && !element.contains(target) && !target.contains(element)))
      .map((element) => toPageRect(element.getBoundingClientRect()))
      .filter((box) => box.width > 0 && box.height > 0 &&
        box.x < viewport.x + viewport.width && box.x + box.width > viewport.x &&
        box.y < viewport.y + viewport.height && box.y + box.height > viewport.y);
    const overlapArea = (a: Rect, b: Rect) =>
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));
    const warnings: string[] = [];

    items.forEach((item, index) => {
      const x = item.x + window.scrollX;
      const y = item.y + window.scrollY;
      const target = frames[index];
      const frame = document.createElement('div');
      frame.style.cssText = `position:absolute;box-sizing:border-box;left:${target.x}px;top:${target.y}px;width:${target.width}px;height:${target.height}px;border:3px solid #ae2828;border-radius:7px;box-shadow:0 0 0 2px #fff8`;
      overlay.appendChild(frame);

      const badge = document.createElement('div');
      badge.textContent = String(index + 1);
      badge.style.cssText = `position:absolute;left:${Math.max(4, x - 17)}px;top:${Math.max(4, y - 19)}px;width:28px;height:28px;border-radius:50%;background:#871b1b;color:white;border:2px solid white;font:bold 16px/24px Arial;text-align:center;box-shadow:0 1px 6px #0008`;
      overlay.appendChild(badge);

      const label = document.createElement('div');
      label.textContent = `${index + 1}. ${item.label}`;
      label.style.cssText = 'position:absolute;box-sizing:border-box;width:190px;padding:4px 7px;border-radius:4px;background:#fffdf9;color:#871b1b;border:1px solid #ae2828;font:bold 14px/1.25 Arial;box-shadow:0 1px 5px #0005';
      overlay.appendChild(label);
      const labelWidth = 190;
      const labelHeight = label.getBoundingClientRect().height;

      // ponytail: жадная раскладка по штрафу достаточна для десяти кадров; на сложных экранах сторону задаём через placement вручную.
      let placement: Rect & { side: Placement; score: number } = {
        x: viewport.x, y: viewport.y, width: labelWidth, height: labelHeight,
        side: item.placement ?? 'right', score: Number.POSITIVE_INFINITY,
      };
      const sides: Placement[] = item.placement
        ? [item.placement, ...(['right', 'left', 'top', 'bottom'] as const).filter((side) => side !== item.placement)]
        : ['right', 'left', 'top', 'bottom'];
      for (const side of sides) {
        const horizontal = side === 'right' || side === 'left';
        const fixed = side === 'right' ? target.x + target.width + 14
          : side === 'left' ? target.x - labelWidth - 14
          : side === 'top' ? target.y - labelHeight - 14
          : target.y + target.height + 14;
        const center = horizontal
          ? target.y + target.height / 2 - labelHeight / 2
          : target.x + target.width / 2 - labelWidth / 2;
        const axes = [center, ...[-40, 40, -80, 80, -120, 120].map((offset) => center + offset),
          horizontal ? target.y : target.x, horizontal ? target.y + target.height - labelHeight : target.x + target.width - labelWidth];
        for (const axis of axes) {
          const candidate = {
            x: clamp(horizontal ? fixed : axis, viewport.x, viewport.x + viewport.width - labelWidth),
            y: clamp(horizontal ? axis : fixed, viewport.y, viewport.y + viewport.height - labelHeight),
            width: labelWidth, height: labelHeight, side,
          };
          const distance = Math.hypot(
            candidate.x + labelWidth / 2 - (target.x + target.width / 2),
            candidate.y + labelHeight / 2 - (target.y + target.height / 2),
          );
          const score = blocked.reduce((sum, box) => sum + overlapArea(candidate, box) * 1000, 0) +
            obstacles.reduce((sum, box) => sum + overlapArea(candidate, box), 0) +
            (side === item.placement ? 0 : distance * 0.02 + (item.placement ? 8 : 0));
          if (score < placement.score) placement = { ...candidate, score };
        }
      }
      label.style.left = `${placement.x}px`;
      label.style.top = `${placement.y}px`;
      const covered = blocked.some((box) => overlapArea(placement, box) > 0)
        ? 'рамку, подпись или область avoid'
        : obstacles.some((box) => overlapArea(placement, box) > 0) ? 'элемент интерфейса' : undefined;
      if (covered) warnings.push(`${item.label}: перекрывает ${covered}`);
      blocked.push(placement);

      const labelCenterX = placement.x + placement.width / 2;
      const labelCenterY = placement.y + placement.height / 2;
      const startX = placement.side === 'right' ? placement.x
        : placement.side === 'left' ? placement.x + placement.width : labelCenterX;
      const startY = placement.side === 'bottom' ? placement.y
        : placement.side === 'top' ? placement.y + placement.height : labelCenterY;
      const endX = placement.side === 'right' ? target.x + target.width + 6
        : placement.side === 'left' ? target.x - 6
          : clamp(labelCenterX, target.x, target.x + target.width);
      const endY = placement.side === 'bottom' ? target.y + target.height + 6
        : placement.side === 'top' ? target.y - 6
          : clamp(labelCenterY, target.y, target.y + target.height);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(startX));
      line.setAttribute('y1', String(startY));
      line.setAttribute('x2', String(endX));
      line.setAttribute('y2', String(endY));
      line.setAttribute('stroke', '#ae2828');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('marker-end', 'url(#docs-arrowhead)');
      svg.appendChild(line);
    });
    return warnings;
  }, { items: boxes, avoid: avoidBoxes, targets });
  for (const warning of warnings) console.warn(`Кадр ${frameName}: ${warning}`);

  return async () => {
    await page.evaluate(() => document.getElementById('docs-annotations')?.remove());
  };
}

async function save(page: Page, fileName: string, steps: Step[]) {
  mkdirSync(mediaDir, { recursive: true });
  const remove = await annotate(page, fileName, steps);
  try {
    await page.screenshot({ path: `${mediaDir}/${fileName}.png`, animations: 'disabled' });
  } finally {
    await remove();
  }
}

test('снимки инструкции на синтетических данных', async ({ page, browser }) => {
  test.skip(process.env.DOCS_SCREENSHOTS !== '1', 'Снимки документации запускаются отдельной командой');
  // ponytail: форма создания зависит от дерева 1С; когда появится стабильная синтетическая фикстура, добавить её кадр.
  await signIn(page, 'rop');
  const complectRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: complects.main.profile, exact: true }) });
  await save(page, 'complects-list', [
    { target: complectRow.getByRole('button', { name: 'Комплект РПД' }), label: 'Открыть комплект' },
  ]);

  await openComplect(page);
  const rpdRow = page.getByRole('row').filter({ hasText: disciplines.inProgress });
  await save(page, 'complect-table', [
    { target: rpdRow.getByRole('cell', { name: disciplines.inProgress }), label: 'Дисциплина' },
    { target: rpdRow.getByRole('cell').nth(3), label: 'Статус и дата' },
  ]);

  // Состав не меняем: в кадре только поиск и флажок нужного аккаунта.
  const teachersDialog = await openTeachersDialog(page, rpdRow, disciplines.inProgress);
  const teacherSearch = teachersDialog.getByRole('textbox', { name: 'Поиск преподавателя' });
  await teacherSearch.fill('Яковлева');
  const teacherCheckbox = teachersDialog.getByRole('checkbox', { name: /Яковлева/ });
  await save(page, 'teacher-selection', [
    { target: teacherSearch, label: 'Найти преподавателя', placement: 'bottom' },
    { target: teacherCheckbox, label: 'Отметить аккаунт', placement: 'right', avoid: [teachersDialog.getByRole('button', { name: 'Закрыть' })] },
  ]);
  await closeTeachersDialog(teachersDialog);

  await page.getByRole('button', { name: 'Собрать ФОСы' }).click();
  const fundsDialog = page.getByRole('dialog', { name: 'Сформировать ФОС' });
  await expect(fundsDialog.getByRole('button', { name: 'Скачать Word' })).toBeEnabled();
  await expect(fundsDialog.getByRole('button', { name: 'Скачать Excel' })).toBeVisible();
  await save(page, 'funds-dialog', [
    { target: fundsDialog.getByRole('combobox', { name: 'Компетенция' }), label: 'Выбрать компетенцию', placement: 'bottom' },
    { target: fundsDialog.getByRole('button', { name: 'Скачать Excel' }), label: 'Скачать Excel', placement: 'top', avoid: [fundsDialog.getByRole('button', { name: 'Закрыть' }), fundsDialog.getByRole('button', { name: 'Скачать Word' })] },
  ]);
  await fundsDialog.getByRole('button', { name: 'Закрыть' }).click();

  await page.getByText('Список компетенций', { exact: true }).click();
  const profile = page.getByRole('combobox', { name: 'Профиль' });
  await profile.click();
  await page.getByRole('option', { name: complects.main.profile, exact: true }).click();
  const form = page.getByRole('combobox', { name: 'Форма обучения' });
  await form.click();
  await page.getByRole('option', { name: 'Очная' }).click();
  const year = page.getByRole('combobox', { name: 'Год набора' });
  await year.click();
  await page.getByRole('option', { name: '2025' }).click();
  await save(page, 'competencies-list', [
    { target: profile, label: 'Профиль', placement: 'bottom' },
    { target: year, label: 'Год набора', placement: 'bottom' },
  ]);

  const teacherContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1280, height: 800 } });
  const secondContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1280, height: 800 } });
  const adminContext = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1280, height: 800 } });
  try {
    const teacherPage = await teacherContext.newPage();
    await signIn(teacherPage, 'teacher');
    const templateRow = teacherPage.getByRole('row').filter({ hasText: 'Совместное редактирование для теста' });
    // Таблица шире окна: прокручиваем к колонке «Действия», чтобы в кадре были статус с отметкой и меню «…».
    const menuButton = templateRow.getByRole('button', { name: 'Меню шаблона', exact: true });
    await menuButton.scrollIntoViewIfNeeded();
    await teacherPage.mouse.move(0, 0);
    await save(teacherPage, 'teacher-templates', [
      { target: templateRow.getByRole('cell').nth(7).getByRole('button'), label: 'Статус и моя отметка' },
      { target: menuButton, label: 'Меню шаблона' },
    ]);
    await openTemplateFromTeacherList(teacherPage, templateRow);
    const aims = teacherPage.getByRole('button', { name: 'Цели и задачи освоения дисциплины' });
    await aims.click();

    const secondPage = await secondContext.newPage();
    await signIn(secondPage, 'teacher2');
    await openTemplateFromTeacherList(secondPage, secondPage.getByRole('row').filter({ hasText: 'Совместное редактирование для теста' }));
    await secondPage.getByRole('button', { name: 'Цели и задачи освоения дисциплины' }).click();
    // Сохранение, последняя правка и присутствие — в блоке внизу панели разделов.
    const status = teacherPage.getByRole('status', { name: 'Сохранение и присутствие' });
    await expect(status.getByText(/Сейчас в шаблоне: Яковлева/)).toBeVisible();
    await teacherPage.getByRole('button', { name: 'Редактировать' }).click();
    const editor = teacherPage.locator('.textEditor [contenteditable="true"]');
    await editor.press('ControlOrMeta+a');
    await editor.pressSequentially('Цель обучения на синтетических данных');
    const saved = teacherPage.waitForResponse((response) => response.request().method() === 'PUT' && response.url().includes('/api/update-json-value/110') && response.ok());
    await teacherPage.getByRole('button', { name: 'Сохранить изменения' }).click();
    await saved;
    await expect(status.getByText(/Изменено: Альфина/)).toBeVisible();
    // Окно остаётся прокрученным после перехода из длинного списка: возвращаем заголовок раздела в кадр.
    await teacherPage.evaluate(() => window.scrollTo(0, 0));
    await save(teacherPage, 'editor-collaboration', [
      { target: aims, label: 'Раздел редактора', avoid: [teacherPage.getByRole('main').getByText(/Изменено: Альфина/)] },
      { target: status, label: 'Статус и участники' },
    ]);

    await secondPage.getByRole('button', { name: 'Список РПД' }).click();
    await openTemplateFromTeacherList(secondPage, secondPage.getByRole('row').filter({ hasText: 'Часы для теста' }));
    await secondPage.getByRole('button', { name: 'Содержание дисциплины' }).click();
    const contentTable = secondPage.getByRole('table', { name: 'Содержание дисциплины' });
    await secondPage.evaluate(() => window.scrollTo(0, 0));
    await save(secondPage, 'discipline-content', [
      { target: contentTable.getByRole('row').filter({ hasText: 'Тема 2' }), label: 'Часы по темам' },
      { target: contentTable.getByRole('row').filter({ hasText: 'Итого за семестр / курс' }), label: 'Сверка с планом 1С' },
    ]);

    await teacherPage.route('**/api/find-books', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': clientUrl, 'access-control-allow-credentials': 'true', 'content-type': 'application/json' },
        body: JSON.stringify({ books: [{
          id: 'https://lib.uni-dubna.ru/MegaPRO/UserEntry?ids=docs-book',
          title: 'База данных «Языки мира»', author: 'Виноградов, В. А.', year: 2003,
          url: null, thumb: null,
          biblio: 'Виноградов, В. А. База данных «Языки мира» / В. А. Виноградов. — 2003.',
        }], truncated: false }),
      });
    });
    await teacherPage.getByRole('button', { name: 'Список РПД' }).click();
    await openTemplateFromTeacherList(teacherPage, teacherPage.getByRole('row').filter({ hasText: 'Литература для теста' }));
    await teacherPage.getByRole('button', { name: 'Ресурсное обеспечение' }).click();
    await teacherPage.getByRole('button', { name: 'Найти книги в библиотечной системе' }).first().click();
    const booksDialog = teacherPage.getByRole('dialog', { name: 'Поиск книг в библиотечной системе' });
    const query = booksDialog.getByRole('textbox', { name: 'Ключевые слова' });
    await query.fill('Виноградов');
    await query.press('Enter');
    const bookRow = booksDialog.getByRole('row').filter({ hasText: 'База данных «Языки мира»' });
    // Диалог расширяется, когда приходит таблица результатов: поле ввода измеряем уже после этого.
    await expect(bookRow).toBeVisible();
    await save(teacherPage, 'books-search', [
      { target: query, label: 'Ключевые слова' },
      { target: bookRow, label: 'Выбрать книгу' },
    ]);

    const adminPage = await adminContext.newPage();
    await signIn(adminPage, 'admin');
    await adminPage.getByText('Пользователи', { exact: true }).click();
    await showAllRows(adminPage);
    const userRow = adminPage.getByRole('row').filter({ has: adminPage.getByRole('cell', { name: 'teacher', exact: true }) });
    await save(adminPage, 'users-list', [
      { target: adminPage.getByRole('button', { name: 'Добавить пользователя' }), label: 'Добавить пользователя' },
      { target: userRow.getByRole('checkbox'), label: 'Выбрать запись' },
    ]);
  } finally {
    await teacherContext.close();
    await secondContext.close();
    await adminContext.close();
  }
});
