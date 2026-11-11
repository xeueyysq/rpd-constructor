import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { apiUrl, password, signIn } from '../helpers';

const complect = { id: 102, uuid: '33333333-3333-4333-8333-333333333333', profile: 'Профиль смены владельца', year: 2025 };

async function headersFor(request: APIRequestContext, userName = 'admin') {
  const response = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName, password } });
  expect(response.status()).toBe(200);
  return { Authorization: `Bearer ${(await response.json()).accessToken as string}` };
}

async function findComplectRow(page: Page, profile: string) {
  // В админском списке фильтры отключены; используем доступную пагинацию.
  await page.getByRole('combobox', { name: 'Строк на странице' }).click();
  await page.getByRole('option', { name: '50', exact: true }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: profile, exact: true }) });
  const next = page.getByRole('button', { name: 'Перейти на следующую страницу', exact: true });
  while (await row.count() === 0 && await next.isEnabled()) {
    const firstRow = page.locator('tbody tr').first();
    const previous = await firstRow.innerText();
    await next.click();
    await expect(firstRow).not.toHaveText(previous);
  }
  await expect(row).toBeVisible();
  return row;
}

test('админ назначает трёх РОП: поиск, сохранение остальных, конфликт и совместимость API', async ({ page, request }) => {
  test.setTimeout(120_000);
  const headers = await headersFor(request);
  const ownerIds = async () => {
    const list = await request.get(`${apiUrl}/api/get-rpd-complects`, { headers });
    expect(list.status()).toBe(200);
    const current = (await list.json() as { id: number; owner: { userId: number }[] }[]).find((item) => item.id === complect.id)!;
    return current.owner.map((owner) => owner.userId).sort((a, b) => a - b);
  };
  const replace = (userIds: number[], baseUserIds: number[], id: number | string = complect.id) =>
    request.put(`${apiUrl}/api/complects/${id}/owners`, { headers, data: { userIds, baseUserIds } });
  const original = await ownerIds();
  const ownerId = original[0];
  const all = [ownerId, 13, 35].sort((a, b) => a - b);
  const actorHeaders = await Promise.all(['rop', 'rop2', 'owner-third-rop', 'field-reopen-rop', 'teacher'].map((name) => headersFor(request, name)));
  try {
    await signIn(page, 'admin');
    const row = await findComplectRow(page, complect.profile);
    await row.getByRole('button', { name: 'Руководов Тест Тестович', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `РОП: ${complect.profile} ${complect.year}` });
    const rops = dialog.getByRole('group', { name: 'РОП', exact: true });
    const first = rops.getByRole('checkbox', { name: 'Руководов Тест Тестович' });
    const second = rops.getByRole('checkbox', { name: 'Другов Тест Тестович' });
    const third = rops.getByRole('checkbox', { name: 'Троев Тест Тестович' });
    await expect(first).toBeChecked();
    await dialog.getByLabel('Поиск РОП').fill('Другов');
    await expect(rops.getByRole('checkbox')).toHaveCount(1);
    await second.click();
    await expect(second).toBeChecked();
    await expect(second).toBeEnabled();
    await dialog.getByLabel('Поиск РОП').fill('Троев');
    await third.click();
    await expect(third).toBeChecked();
    await expect(third).toBeEnabled();
    await dialog.getByLabel('Поиск РОП').clear();
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
    await expect(third).toBeChecked();
    expect(await ownerIds()).toEqual(all);

    // Каждый владелец управляет и числовым ID, и UUID; отдельный participant не добавляется.
    for (const actor of actorHeaders.slice(0, 3)) {
      for (const id of [complect.id, complect.uuid]) {
        expect((await request.post(`${apiUrl}/api/find-rpd`, { headers: actor, data: { complectId: id } })).status()).toBe(200);
      }
      const snapshot = await request.get(`${apiUrl}/api/templates/350/workflow`, { headers: actor });
      expect(snapshot.status()).toBe(200);
      expect(await snapshot.json()).toMatchObject({ canEditTeachers: true, participants: [expect.objectContaining({ userId: 35, state: 'assigned' })] });
      expect((await request.put(`${apiUrl}/api/complects/${complect.id}/owners`, { headers: actor, data: { userIds: [], baseUserIds: all } })).status()).toBe(403);
      expect((await request.put(`${apiUrl}/api/complects/${complect.id}/owner`, { headers: actor, data: { userId: 35 } })).status()).toBe(403);
    }
    expect((await request.post(`${apiUrl}/api/find-rpd`, { headers: actorHeaders[3], data: { complectId: complect.uuid } })).status()).toBe(403);
    expect((await request.get(`${apiUrl}/api/templates/350/workflow`, { headers: actorHeaders[3] })).status()).toBe(403);
    expect((await request.put(`${apiUrl}/api/complects/${complect.id}/owners`, { headers: actorHeaders[4], data: { userIds: [], baseUserIds: all } })).status()).toBe(403);
    expect((await request.put(`${apiUrl}/api/complects/${complect.id}/owners`, { data: { userIds: [], baseUserIds: all } })).status()).toBe(401);

    // Весь набор проверяется до записи: неверный элемент не удаляет существующих.
    for (const userIds of [[ownerId, 10], [ownerId, 36], [ownerId, 999999], [ownerId, ownerId], [0], [-1], [1.5], ['13'], [2147483648]]) {
      const result = await request.put(`${apiUrl}/api/complects/${complect.uuid}/owners`, { headers, data: { userIds, baseUserIds: all } });
      expect(result.status()).toBe(422);
      expect(await ownerIds()).toEqual(all);
    }
    expect((await request.put(`${apiUrl}/api/complects/${complect.id}/owners`, { headers, data: { userIds: all } })).status()).toBe(422);

    await third.click();
    await expect(third).not.toBeChecked();
    await expect(third).toBeEnabled();
    const two = [ownerId, 13].sort((a, b) => a - b);
    expect(await ownerIds()).toEqual(two);
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
    // Снятый РОП со старым JWT теряет управление, но остаётся преподавателем РПД.
    expect((await request.post(`${apiUrl}/api/find-rpd`, { headers: actorHeaders[2], data: { complectId: complect.uuid } })).status()).toBe(403);
    const participant = await request.get(`${apiUrl}/api/templates/350/workflow`, { headers: actorHeaders[2] });
    expect(participant.status()).toBe(200);
    expect(await participant.json()).toMatchObject({ canEditTeachers: false, participants: [expect.objectContaining({ userId: 35, state: 'assigned' })] });
    for (const actor of actorHeaders.slice(0, 2)) {
      expect((await request.post(`${apiUrl}/api/find-rpd`, { headers: actor, data: { complectId: complect.id } })).status()).toBe(200);
    }

    // Другой администратор меняет БД, пока открытый диалог держит прежний состав.
    expect((await replace(all, two, complect.uuid)).status()).toBe(200);
    await second.click();
    await expect(dialog.getByRole('alert')).toContainText('Состав РОП изменён другим администратором');
    await expect(first).toBeChecked();
    await expect(second).toBeChecked();
    await expect(third).toBeChecked();
    expect(await ownerIds()).toEqual(all);
    // Повторный выбор использует обновлённую базу, а не замыкание до конфликта.
    await second.click();
    await expect(second).not.toBeChecked();
    await expect(second).toBeEnabled();
    expect(await ownerIds()).toEqual([ownerId, 35].sort((a, b) => a - b));
    await dialog.getByRole('button', { name: 'Закрыть' }).click();
    await expect(row.getByRole('button', { name: 'Руководов Тест Тестович', exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Троев Тест Тестович', exact: true })).toBeVisible();

    // Конкурентные HTTP-транзакции с одной базой: ровно одна запись, второй — 409.
    expect((await replace(all, await ownerIds())).status()).toBe(200);
    const contenders = [two, [ownerId, 35].sort((a, b) => a - b)];
    const raced = await Promise.all(contenders.map((ids) => replace(ids, all)));
    expect(raced.map((response) => response.status()).sort()).toEqual([200, 409]);
    expect(await ownerIds()).toEqual(contenders[raced.findIndex((response) => response.status() === 200)]);

    // Legacy scalar остаётся полной заменой, plural разрешает снять всех.
    const legacy = await request.put(`${apiUrl}/api/complects/${complect.uuid}/owner`, { headers, data: { userId: 35 } });
    expect(legacy.status()).toBe(200);
    expect(await legacy.json()).toEqual({ complectId: complect.id, userId: 35 });
    expect(await ownerIds()).toEqual([35]);
    expect((await replace([], [35])).status()).toBe(200);
    expect(await ownerIds()).toEqual([]);
    const preserved = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers: actorHeaders[2], data: { id: 'a350a350a350' } });
    expect(preserved.status()).toBe(200);
    expect(await preserved.json()).toMatchObject({ goals: '<p>Сохранённое содержание владельцев</p>' });
  } finally {
    const restored = await replace(original, await ownerIds());
    expect(restored.status()).toBe(200);
  }
});

test('первое назначение после создания и прежние недопустимые владельцы не блокируют активных РОП', async ({ page, request }) => {
  const headers = await headersFor(request);
  const ownerIds = async (id: number) => {
    const response = await request.get(`${apiUrl}/api/get-rpd-complects`, { headers });
    expect(response.status()).toBe(200);
    const rows = await response.json() as { id: number; owner: { userId: number }[] }[];
    return rows.find((row) => row.id === id)!.owner.map((owner) => owner.userId).sort((a, b) => a - b);
  };
  await signIn(page, 'admin');
  // Seed воспроизводит связи после exchange1C, сам HTTP-импорт из 1С здесь не вызывается.
  for (const fixture of [
    { id: 360, profile: 'Первое назначение РОП после создания', retained: [], invalid: [] },
    { id: 361, profile: 'Прежние недопустимые владельцы', retained: [13], invalid: [10, 36] },
  ]) {
    const original = await ownerIds(fixture.id);
    expect(original).toHaveLength(1 + fixture.retained.length + fixture.invalid.length);
    expect(original).toEqual(expect.arrayContaining([...fixture.retained, ...fixture.invalid]));
    const stale = await request.put(`${apiUrl}/api/complects/${fixture.id}/owners`, {
      headers, data: { userIds: [35, ...fixture.retained], baseUserIds: fixture.retained },
    });
    expect(stale.status()).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { userIds: original } });
    expect(await ownerIds(fixture.id)).toEqual(original);

    const row = await findComplectRow(page, fixture.profile);
    await row.getByRole('button', { name: 'Админов Тест Тестович', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `РОП: ${fixture.profile} 2026`, exact: true });
    await expect(dialog.getByRole('alert')).toContainText('При следующем изменении состава эти назначения будут сняты');
    await expect(dialog.getByRole('alert')).toContainText('Админов Тест Тестович');
    const selected = dialog.getByRole('checkbox', { name: 'Троев Тест Тестович', exact: true });
    const saved = page.waitForResponse((response) => response.url() === `${apiUrl}/api/complects/${fixture.id}/owners`
      && response.request().method() === 'PUT');
    if (fixture.invalid.length) {
      await expect(dialog.getByRole('alert')).toContainText('Яковлева Тест Тестовна');
      await expect(dialog.getByRole('alert')).toContainText('Неактивов Тест Тестович');
      // Одиночное снятие недопустимого владельца при ещё двух недопустимых связях.
      await dialog.getByRole('checkbox', { name: 'Неактивов Тест Тестович', exact: true }).click();
    } else {
      await selected.click();
    }
    const response = await saved;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().baseUserIds.sort((a: number, b: number) => a - b)).toEqual(original);
    await expect(selected).toBeEnabled();
    expect(await ownerIds(fixture.id)).toEqual(fixture.invalid.length ? fixture.retained : [35]);
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    if (fixture.retained.length) {
      await expect(dialog.getByRole('checkbox', { name: 'Другов Тест Тестович', exact: true })).toBeChecked();
      await expect(dialog.getByRole('checkbox', { name: 'Неактивов Тест Тестович', exact: true })).toHaveCount(0);
      const added = page.waitForResponse((result) => result.url() === `${apiUrl}/api/complects/${fixture.id}/owners`
        && result.request().method() === 'PUT');
      await selected.click();
      expect((await added).status()).toBe(200);
      await expect(selected).toBeChecked();
      await expect(selected).toBeEnabled();
      expect(await ownerIds(fixture.id)).toEqual([...fixture.retained, 35].sort((a, b) => a - b));
      const removed = page.waitForResponse((result) => result.url() === `${apiUrl}/api/complects/${fixture.id}/owners`
        && result.request().method() === 'PUT');
      await selected.click();
      expect((await removed).status()).toBe(200);
      await expect(selected).not.toBeChecked();
      await expect(selected).toBeEnabled();
      expect(await ownerIds(fixture.id)).toEqual(fixture.retained);
    } else {
      await expect(selected).toBeChecked();
    }
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  }
});

test('создание РОП: production HTTP/JWT/PG, полные и пустые владельцы, атомарность и блокировки', async () => {
  test.setTimeout(90_000);
  // Как teacherCards: реальный listener и PG, единственная подмена — внешняя axios1C.
  const env = parseEnv(readFileSync(new URL('../../e2e.env', import.meta.url), 'utf8'));
  const path = fileURLToPath(new URL('../../../rpd-server/tests/integration/complectCreation.ts', import.meta.url));
  const output = execFileSync('node', [path], { env: { ...process.env, ...env },
    encoding: 'utf8', timeout: 60_000 });
  expect(JSON.parse(output)).toEqual({ completed: true });
});
