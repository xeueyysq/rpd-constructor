import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { apiUrl, showAllRows, signIn } from '../helpers';
import { competenciesFromDb, headersFor, openFixtureComplect, syncFixtures } from '../list3';

const require = createRequire(new URL('../../../rpd-client-ts/package.json', import.meta.url));
const ExcelJS = require('exceljs') as typeof import('../../../rpd-client-ts/node_modules/exceljs');
const targets = [syncFixtures.dialogA, syncFixtures.dialogB] as const;
const expected = (name: string) => [{ competence: `УК-1. ${name}`, indicator: 'УК-1.1. Находит данные', disciplines: ['Физика'] }];

function csv(name: string, invalid = false) {
  const text = `Компетенция;Индикатор;Код;Наименование\nУК-1;;;${name}\n;УК-1.1;;Находит данные\n;;Б1;Физика${invalid ? '\n;ПК-2.1;;Чужой индикатор' : ''}`;
  // Настоящие байты CP1251, а не UTF-8 под другим именем.
  const bytes = Buffer.from([...text].map((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x410 && code <= 0x44f ? code - 0x350 : char === 'Ё' ? 0xa8 : char === 'ё' ? 0xb8 : code;
  }));
  return { name: 'компетенции.csv', mimeType: 'text/csv', buffer: bytes };
}

async function persisted(request: APIRequestContext, headers: Record<string, string>, id: number) {
  const result = await request.get(`${apiUrl}/api/get-results-data`, { headers, params: { complectId: id } });
  expect(result.status()).toBe(200);
  return result.json();
}

async function openListDialog(page: Page, profile: string) {
  await showAllRows(page);
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: profile, exact: true }) });
  const previousPage = page.getByRole('button', { name: 'Перейти на предыдущую страницу', exact: true });
  while (await previousPage.isEnabled()) {
    const previous = await page.locator('tbody tr').first().innerText();
    await previousPage.click();
    await expect(page.locator('tbody tr').first()).not.toHaveText(previous);
  }
  const next = page.getByRole('button', { name: 'Перейти на следующую страницу', exact: true });
  while (await row.count() === 0 && await next.isEnabled()) {
    const previous = await page.locator('tbody tr').first().innerText();
    await next.click();
    await expect(page.locator('tbody tr').first()).not.toHaveText(previous);
  }
  await row.getByRole('button', { name: 'Компетенции', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /^Компетенции/ });
  await expect(dialog).toContainText(profile);
  return dialog;
}

async function upload(page: Page, dialog: Locator, file: ReturnType<typeof csv>, id: number) {
  const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/set-results-data`
    && response.request().postDataJSON()?.complectId === id);
  await dialog.getByLabel('Файл компетенций').setInputFiles(file);
  expect((await saved).status()).toBe(200);
  await expect(dialog.getByText('Компетенции сохранены', { exact: true })).toBeVisible();
}

test.describe('матрица выбранного комплекта', () => {
  test.describe.configure({ mode: 'serial' });

  test('CP1251 CSV и XLSX сохраняются через API; закрытие, reload и ошибочный файл сохраняют результат', async ({ page, request }) => {
    const headers = await headersFor(request, 'admin');
    await signIn(page, 'admin');
    let dialog = await openListDialog(page, targets[0].profile);
    await expect(dialog.getByRole('combobox')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Сохранить', exact: true })).toHaveCount(0);
    expect(await persisted(request, headers, targets[0].id)).toEqual([]);
    const empty = dialog.getByText('Компетенции пока не были загружены', { exact: true });
    await expect(empty).toBeVisible();
    const emptyGeometry = await empty.evaluate((element) => {
      const text = element.getBoundingClientRect();
      const area = element.closest('.MuiTableContainer-root')!.getBoundingClientRect();
      const header = element.closest('table')!.querySelector('thead')!.getBoundingClientRect();
      return { textX: text.x + text.width / 2, textY: text.y + text.height / 2,
        bodyX: area.x + area.width / 2, bodyY: header.bottom + (area.bottom - header.bottom) / 2,
        headerHeight: header.height };
    });
    expect(Math.abs(emptyGeometry.textX - emptyGeometry.bodyX)).toBeLessThanOrEqual(2);
    expect(Math.abs(emptyGeometry.textY - emptyGeometry.bodyY)).toBeLessThanOrEqual(2);
    const uploadButton = dialog.getByRole('button', { name: 'Загрузить файл', exact: true });
    await expect(uploadButton).toHaveClass(/MuiButton-contained/);
    await upload(page, dialog, csv('Анализ'), targets[0].id);
    expect(await persisted(request, headers, targets[0].id)).toEqual(expected('Анализ'));
    expect(competenciesFromDb(targets[0].id)).toEqual(expected('Анализ'));
    await expect(dialog.getByRole('table')).toContainText('УК-1. Анализ');
    expect(await dialog.locator('thead').evaluate((header) => header.getBoundingClientRect().height)).toBeCloseTo(emptyGeometry.headerHeight, 0);
    const feedbackTrigger = page.getByRole('button', { name: 'Сообщить о проблеме', exact: true });
    await expect(feedbackTrigger).toHaveCount(1);
    await feedbackTrigger.click();
    const feedback = page.getByRole('dialog', { name: 'Сообщить о проблеме', exact: true });
    await expect(feedback).not.toContainText('Контекст:');
    await expect(feedback.locator('details, summary, pre')).toHaveCount(0);
    await page.keyboard.press('Tab');
    expect(await feedback.evaluate((paper) => paper.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(feedback).toBeHidden();
    await expect(feedbackTrigger).toBeFocused();
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
    dialog = await openListDialog(page, targets[0].profile);
    await expect(dialog.getByRole('table')).toContainText('УК-1. Анализ');
    await page.reload();
    dialog = await openListDialog(page, targets[0].profile);
    await expect(dialog.getByRole('table')).toContainText('УК-1. Анализ');

    const posts: unknown[] = [];
    page.on('request', (sent) => { if (sent.url() === `${apiUrl}/api/set-results-data`) posts.push(sent.postDataJSON()); });
    for (const file of [csv('Не сохранять', true), { name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('a;b;c;d\n') }]) {
      await dialog.getByLabel('Файл компетенций').setInputFiles(file);
      await expect(dialog.getByRole('alert')).toContainText(/строка|Данные не найдены/);
      await expect(dialog.getByRole('table')).toContainText('УК-1. Анализ');
      expect(await persisted(request, headers, targets[0].id)).toEqual(expected('Анализ'));
      expect(competenciesFromDb(targets[0].id)).toEqual(expected('Анализ'));
    }
    expect(posts).toEqual([]);

    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Компетенции').addRows([
      ['Компетенция', 'Индикатор', 'Код', 'Наименование'],
      ['', 'ПК-4', '', 'Разработка'], ['', '', 'Б1', 'Базы данных'],
    ]);
    const file = { name: 'компетенции.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    await upload(page, dialog, file, targets[0].id);
    const legacy = [{ competence: 'ПК-4. Разработка', indicator: '—', disciplines: ['Базы данных'] }];
    expect(await persisted(request, headers, targets[0].id)).toEqual(legacy);
    expect(competenciesFromDb(targets[0].id)).toEqual(legacy);
    // Повтор того же файла должен снова дойти до сохранения.
    await upload(page, dialog, file, targets[0].id);
    await page.reload();
    await openFixtureComplect(page, targets[0].id);
    await page.getByRole('button', { name: 'Компетенции', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /^Компетенции/ }).getByRole('table')).toContainText('ПК-4. Разработка');
    expect(await persisted(request, headers, targets[0].id)).toEqual(legacy);
  });

  test('поздний GET A и ответ загрузки A не заполняют B и не меняют его матрицу', async ({ page, request }) => {
    const headers = await headersFor(request, 'admin');
    for (const [index, target] of targets.entries()) {
      const result = await request.post(`${apiUrl}/api/set-results-data`, { headers, data: { complectId: target.id, data: expected(index ? 'Матрица Б' : 'Матрица А') } });
      expect(result.status()).toBe(200);
    }
    await signIn(page, 'admin');
    let releaseGet!: () => void;
    const heldGet = new Promise<void>((resolve) => { releaseGet = resolve; });
    let getStarted!: () => void;
    const started = new Promise<void>((resolve) => { getStarted = resolve; });
    await page.route('**/api/get-results-data?*', async (route) => {
      if (new URL(route.request().url()).searchParams.get('complectId') !== String(targets[0].id)) return route.continue();
      const response = await route.fetch();
      getStarted();
      await heldGet;
      await route.fulfill({ response }).catch(() => {}); // Закрытый диалог отменяет именно этот GET.
    });
    try {
      const first = await openListDialog(page, targets[0].profile);
      await started;
      await first.getByRole('button', { name: 'Закрыть', exact: true }).click();
      const second = await openListDialog(page, targets[1].profile);
      await expect(second.getByRole('table')).toContainText('Матрица Б');
      releaseGet();
      await expect(second.getByRole('table')).not.toContainText('Матрица А');
      await second.getByRole('button', { name: 'Закрыть', exact: true }).click();
    } finally { releaseGet(); await page.unroute('**/api/get-results-data?*'); }

    let releasePost!: () => void;
    const heldPost = new Promise<void>((resolve) => { releasePost = resolve; });
    let posted!: () => void;
    const didPost = new Promise<void>((resolve) => { posted = resolve; });
    await page.route('**/api/set-results-data', async (route) => {
      expect(route.request().postDataJSON().complectId).toBe(targets[0].id);
      const response = await route.fetch();
      posted();
      await heldPost;
      await route.fulfill({ response });
    });
    try {
      const first = await openListDialog(page, targets[0].profile);
      await expect(first.getByRole('table')).toContainText('Матрица А');
      await first.getByLabel('Файл компетенций').setInputFiles(csv('Новое А'));
      await didPost;
      await expect(first.getByRole('button', { name: 'Загрузить файл' })).toHaveAttribute('aria-disabled', 'true');
      await expect(first.getByText('Компетенции сохранены')).toHaveCount(0);
      await first.getByRole('button', { name: 'Закрыть', exact: true }).click();
      const second = await openListDialog(page, targets[1].profile);
      await expect(second.getByRole('table')).toContainText('Матрица Б');
      const reread = page.waitForResponse((response) => response.url().includes('/api/get-results-data?') && new URL(response.url()).searchParams.get('complectId') === String(targets[0].id));
      releasePost();
      await reread;
      await expect(second.getByRole('table')).not.toContainText('Новое А');
      await expect(second.getByText('Компетенции сохранены')).toHaveCount(0);
      expect(await persisted(request, headers, targets[0].id)).toEqual(expected('Новое А'));
      expect(await persisted(request, headers, targets[1].id)).toEqual(expected('Матрица Б'));
      expect(competenciesFromDb(targets[0].id)).toEqual(expected('Новое А'));
      expect(competenciesFromDb(targets[1].id)).toEqual(expected('Матрица Б'));
    } finally { releasePost(); }
  });

  test('закрытие во время чтения XLSX не отправляет матрицу в A или B', async ({ page, request }) => {
    const headers = await headersFor(request, 'admin');
    const before = await Promise.all(targets.map((target) => persisted(request, headers, target.id)));
    await signIn(page, 'admin');
    const dialog = await openListDialog(page, targets[0].profile);
    await expect(dialog.getByRole('button', { name: 'Загрузить файл' })).not.toHaveAttribute('aria-disabled', 'true');
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Компетенции').addRows([
      ['Компетенция', 'Индикатор', 'Код', 'Наименование'], ['УК-1', '', '', 'Отменённая матрица'],
      ['', 'УК-1.1', '', 'Находит данные'], ['', '', 'Б1', 'Физика'],
    ]);
    await page.evaluate(() => {
      const original = File.prototype.arrayBuffer;
      let release!: () => void;
      const hold = new Promise<void>((resolve) => { release = resolve; });
      const state = window as typeof window & { releaseCompetenciesFile?: () => void; readingCompetenciesFile?: boolean; finishedCompetenciesFile?: boolean };
      state.releaseCompetenciesFile = release;
      File.prototype.arrayBuffer = async function () {
        state.readingCompetenciesFile = true;
        await hold;
        try { return await original.call(this); } finally { File.prototype.arrayBuffer = original; state.finishedCompetenciesFile = true; }
      };
    });
    const posts: unknown[] = [];
    page.on('request', (sent) => { if (sent.url() === `${apiUrl}/api/set-results-data`) posts.push(sent.postDataJSON()); });
    try {
      await dialog.getByLabel('Файл компетенций').setInputFiles({ name: 'slow.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
      await expect.poll(() => page.evaluate(() => (window as typeof window & { readingCompetenciesFile?: boolean }).readingCompetenciesFile)).toBe(true);
      await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
      const second = await openListDialog(page, targets[1].profile);
      await page.evaluate(() => (window as typeof window & { releaseCompetenciesFile?: () => void }).releaseCompetenciesFile?.());
      await expect.poll(() => page.evaluate(() => (window as typeof window & { finishedCompetenciesFile?: boolean }).finishedCompetenciesFile)).toBe(true);
      await expect(second.getByRole('table')).toContainText('Матрица Б');
      await expect(second.getByRole('table')).not.toContainText('Отменённая матрица');
      expect(await Promise.all(targets.map((target) => persisted(request, headers, target.id)))).toEqual(before);
      expect(posts).toEqual([]);
    } finally { await page.evaluate(() => (window as typeof window & { releaseCompetenciesFile?: () => void }).releaseCompetenciesFile?.()); }
  });
});
