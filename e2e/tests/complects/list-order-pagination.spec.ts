import { expect, test } from '@playwright/test';
import { apiUrl, signIn } from '../helpers';
import { applyTeachersDialog, assignTeacher, openRowMenu, openTeachersDialog, selectTeacher } from '../teacherAssignments';

const fixture = { uuid: '37037037-0370-4370-8370-370370370370', templateId: 3716, discipline: 'Программирование' };

// Независимое ожидание алфавита, без сортировки ответа сервера или импорта компаратора приложения.
const expected = [
  [3744, 'Алгебра', 1],
  [3743, 'Алгоритмы', 1],
  [3742, 'Анализ данных', 1],
  [3741, 'Архитектура', 1],
  [3740, 'Базы данных', 1],
  [3739, 'Безопасность', 1],
  [3738, 'Биология', 1],
  [3737, 'Веб технологии', 1],
  [3736, 'География', 1],
  [3735, 'Геометрия', 1],
  [3734, 'Дизайн', 1],
  [3733, 'Дискретная математика', 1],
  [3732, 'Ежовые данные', 1],
  [3731, 'Ёжовые данные', 1],
  [3730, 'Жизненный цикл', 1],
  [3729, 'Защита данных', 1],
  [3728, 'Инженерия', 1],
  [3727, 'Информатика', 1],
  [3726, 'История', 1],
  [3725, 'Компьютерная графика', 1],
  [3724, 'Линейная алгебра', 1],
  [3723, 'Логика', 1],
  [3721, 'Математика', 2],
  [3722, 'Математика', 1],
  [3720, 'Машинное обучение', 1],
  [3719, 'Моделирование', 1],
  [3718, 'Операционные системы', 1],
  [3717, 'Оптимизация', 1],
  [3716, 'Программирование', 1],
  [3715, 'Проектирование', 1],
  [3714, 'Разработка', 1],
  [3713, 'Робототехника', 1],
  [3712, 'Сети', 1],
  [3711, 'Системный анализ', 1],
  [3710, 'Статистика', 1],
  [3709, 'Теория вероятностей', 1],
  [3708, 'Теория графов', 1],
  [3707, 'Тестирование', 1],
  [3706, 'Управление', 1],
  [3705, 'Физика', 1],
  [3704, 'Философия', 1],
  [3703, 'Химия', 1],
  [3702, 'Экология', 1],
  [3701, 'Экономика', 1],
  [3700, 'Языки программирования', 1],
] as const;

test('русский алфавит при открытии; назначение, снятие и статус сохраняют вторую страницу и положение', async ({ page }) => {
  await signIn(page, 'admin');
  const loaded = page.waitForResponse((response) => response.url() === `${apiUrl}/api/find-rpd`
    && response.request().postDataJSON()?.complectId === fixture.uuid && response.status() === 200);
  await page.goto(`/complects/${fixture.uuid}`);
  const { templates } = await (await loaded).json() as { templates: { id: number; discipline: string; semester: number }[] };
  // Связываем видимые имя/семестр с настоящими exchange IDs. Ожидаемый порядок задан выше вручную.
  const identities = new Map(templates.map((row) => [`${row.discipline}|${row.semester}`, row.id]));
  const rows = page.locator('tbody tr');
  const size = page.getByRole('combobox', { name: 'Строк на странице' });
  const disciplineHeader = page.getByRole('columnheader').filter({ hasText: 'Дисциплина' });
  await expect(disciplineHeader).toHaveAttribute('aria-sort', 'ascending');

  async function expectPage(index: number) {
    const chunk = expected.slice(index * 20, (index + 1) * 20);
    await expect(page.getByText(`${index * 20 + 1}-${Math.min((index + 1) * 20, 45)} из 45`, { exact: true })).toBeVisible();
    await expect(size).toHaveText('20');
    await expect(rows).toHaveCount(chunk.length);
    await expect(rows.locator('td:first-child')).toHaveText(chunk.map((row) => row[1]));
    const visible = await rows.evaluateAll((elements) => elements.map((row) => {
      const cells = row.querySelectorAll('td');
      return `${cells[0].textContent?.trim()}|${cells[1].textContent?.trim()}`;
    }));
    expect(visible.map((key) => identities.get(key))).toEqual(chunk.map((row) => row[0]));
  }

  await expectPage(0);
  const next = page.getByRole('button', { name: 'Перейти на следующую страницу', exact: true });
  await next.click();
  await expectPage(1);
  await next.click();
  await expectPage(2);
  await page.getByRole('button', { name: 'Перейти на предыдущую страницу', exact: true }).click();
  await expectPage(1);

  const target = rows.filter({ has: page.getByRole('cell', { name: fixture.discipline, exact: true }) });
  const teachers = target.getByRole('cell').nth(2);
  const status = target.getByRole('cell').nth(3);
  await expect(teachers).toContainText('Яковлева Тест Тестовна');
  await expect(status).toContainText('Назначены преподаватели');
  await target.scrollIntoViewIfNeeded();
  const readPosition = () => target.evaluate((row) => {
    const container = row.closest('table')!.parentElement!;
    return { windowX: window.scrollX, windowY: window.scrollY, tableX: container.scrollLeft,
      tableY: container.scrollTop, rowTop: row.getBoundingClientRect().top };
  });
  const before = await readPosition();
  expect(before.windowY + before.tableY, 'Сценарий должен проверять ненулевую прокрутку').toBeGreaterThan(0);
  const marker = 'list-order-document';
  await page.evaluate((value) => { document.documentElement.dataset.listOrderDocument = value; }, marker);
  let navigations = 0;
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations += 1; });

  async function expectSamePosition() {
    // Даём браузеру завершить layout и отложенный reset Table Core перед измерением.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expectPage(1);
    const after = await readPosition();
    for (const key of ['windowX', 'windowY', 'tableX', 'tableY', 'rowTop'] as const) {
      expect(Math.abs(after[key] - before[key]), key).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => document.documentElement.dataset.listOrderDocument)).toBe(marker);
    expect(navigations, 'Изменение ячейки не должно вызывать навигацию документа').toBe(0);
  }

  const addedName = 'Третьева Тест Тестовна';
  await assignTeacher(page, target, fixture.discipline, addedName);
  await expect(teachers.getByRole('listitem')).toHaveCount(2);
  await expectSamePosition();

  const dialog = await openTeachersDialog(page, target, fixture.discipline);
  await selectTeacher(dialog, addedName, false);
  await applyTeachersDialog(page, dialog);
  await expect(teachers).not.toContainText(addedName);
  await expect(teachers.getByRole('listitem')).toHaveCount(1);
  await expect(teachers).toContainText('Яковлева Тест Тестовна');
  await expectSamePosition();

  const menu = await openRowMenu(page, target);
  const accepted = page.waitForResponse((response) => response.url() === `${apiUrl}/api/templates/${fixture.templateId}/workflow`
    && response.request().method() === 'POST');
  await menu.getByRole('menuitem', { name: 'Принять', exact: true }).click();
  expect((await accepted).status()).toBe(200);
  await expect(status.getByRole('button', { name: 'Готов', exact: true })).toBeVisible();
  await expectSamePosition();
});
