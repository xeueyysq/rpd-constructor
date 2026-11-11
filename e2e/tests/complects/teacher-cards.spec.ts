import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { expect, test } from '@playwright/test';
import { apiUrl, filterColumn, password, signIn, signInWithCredentials } from '../helpers';
import { headersFor } from '../list3';

const mainName = 'Карточкин Синтетик Проверкович';
const twoPartName = 'Двусловов Синтетик';
const reusedName = 'Совместов Синтетик Проверкович';
const inactiveName = 'Спящий Синтетик Проверкович';
const ropName = 'Руководителев Синтетик Проверкович';
const adminName = 'Администрев Синтетик Проверкович';
const ambiguousName = 'Тезков Синтетик Проверкович';
const unchangedName = 'Неизменов Синтетик Проверкович';
const excludedName = 'Исключенов Синтетик Проверкович';
const onlyImportName = 'Дозагрузов Синтетик Проверкович';
const rollbackName = 'Откатов Синтетик Проверкович';
const forgedName = 'Подделов Синтетик Проверкович';
const concurrentName = 'Параллелев Синтетик Проверкович';
const allNames = [mainName, twoPartName, reusedName, inactiveName, ropName, adminName, ambiguousName,
  unchangedName, excludedName, onlyImportName, rollbackName, forgedName, concurrentName];
const raw = (discipline: string, teachers: string[]) => ({ discipline, teachers, division: 'Синтетическая кафедра карточек',
  semester: 1, record_type: '1.О', study_load: { 'Лекции': 36 }, control_load: {} });
const source = [raw('Карточки источника', [mainName, `${mainName} (вн.совм.)`, twoPartName,
  `${reusedName} (внеш.совм.)`, inactiveName, ropName, adminName, ambiguousName,
  'Вакансия кафедра тестирования', 'Инициалов С.П.'])];

type Source = ReturnType<typeof raw>[];
type Incoming = { discipline: string; teachers: string[]; [key: string]: unknown };
type Preview = { teacherImportManifest: string; diff: { new: { incoming: Incoming }[];
  updated: { id_1c: number; incoming: Incoming }[]; unchanged: { incoming: Incoming }[] } };
type User = { id: number; name: string | null; role: number; fullname: { surname: string; name: string; patronymic: string };
  is_active: boolean; has_credentials: boolean };
type State = { users: User[]; links: { label_key: string; user_id: number | null }[];
  exchange: { id: number; teachers: string[] }[]; participants: unknown[]; [key: string]: unknown };

// Нет HTTP/API stubs: child process вызывает владельцев create/preview/import
// на настоящем PostgreSQL; единственная подмена — axios внешней 1С.
function driver<T>(command: Record<string, unknown>): T {
  const env = parseEnv(readFileSync(new URL('../../e2e.env', import.meta.url), 'utf8'));
  const path = fileURLToPath(new URL('../../../rpd-server/tests/integration/teacherCards.ts', import.meta.url));
  const output = execFileSync('node', [path], { env: { ...process.env, ...env },
    input: JSON.stringify(command), encoding: 'utf8', timeout: 15_000 });
  return JSON.parse(output) as T;
}
const snapshot = (ids: number[]) => driver<State>({ operation: 'state', names: allNames, complectIds: ids });
const userByName = (state: State, name: string) => state.users.filter((user) =>
  [user.fullname.surname, user.fullname.name, user.fullname.patronymic].filter(Boolean).join(' ') === name);
const preview = (id: number, data: Source, operation = 'preview') => driver<Preview>({ operation, complectId: id, source: data });

test('полная нагрузка создаёт назначаемые карточки атомарно, вход настраивает администратор', async ({ page, request }) => {
  const fixtures = [
    { login: 'cards-reused', name: reusedName, role: 2, active: true },
    { login: 'cards-inactive', name: inactiveName, role: 2, active: false },
    { login: 'cards-rop', name: ropName, role: 3, active: true },
    { login: 'cards-admin', name: adminName, role: 1, active: true },
    { login: 'cards-ambiguous-a', name: ambiguousName, role: 2, active: true },
    { login: 'cards-ambiguous-b', name: ambiguousName, role: 3, active: true },
  ].map(({ name, ...fixture }) => {
    const [surname, givenName, patronymic] = name.split(' ');
    return { ...fixture, fullname: { surname, name: givenName, patronymic } };
  });
  const { id, actorId } = driver<{ id: number; actorId: number }>({ operation: 'create', source, fixtures, fixturePassword: password });
  const headers = await headersFor(request, 'admin');
  const initial = snapshot([id]);
  expect(initial.users).toHaveLength(8);
  expect(initial.vacancyCardCount).toBe(0);
  expect(initial.participants).toEqual([]);
  expect(userByName(initial, mainName)).toHaveLength(1);
  const card = userByName(initial, twoPartName)[0]!;
  expect(card).toMatchObject({ name: null, role: 2, is_active: true, has_credentials: false,
    fullname: { surname: 'Двусловов', name: 'Синтетик', patronymic: '' } });
  expect(userByName(initial, inactiveName)).toMatchObject([{ name: 'cards-inactive', is_active: false }]);
  expect(userByName(initial, ropName)).toMatchObject([{ name: 'cards-rop', role: 3 }]);
  expect(userByName(initial, adminName)).toMatchObject([{ name: 'cards-admin', role: 1 }]);
  expect(userByName(initial, ambiguousName)).toHaveLength(2);
  expect(initial.links.find((row) => row.label_key === ambiguousName.toLowerCase())?.user_id).toBeNull();
  const noRefresh = driver<{ refreshDenied: boolean }>({ operation: 'noRefresh', cardId: card.id });
  expect(noRefresh.refreshDenied).toBe(true);
  const beforeLogin = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName: twoPartName, password } });
  expect([403, 404]).toContain(beforeLogin.status());

  const readRows = async () => {
    const response = await request.post(`${apiUrl}/api/find-rpd`, { headers, data: { complectId: id } });
    expect(response.status()).toBe(200);
    return (await response.json()).templates as { id: number; discipline: string; id_profile_template: number;
      teacherHints: { name: string; userId: number | null }[]; participants: { userId: number }[] }[];
  };
  const rows = await readRows();
  const sourceRow = rows.find((row) => row.discipline === 'Карточки источника')!;
  expect(sourceRow).toBeDefined();
  expect(sourceRow.participants).toEqual([]);
  expect(sourceRow.teacherHints.filter((hint) => hint.name === mainName)).toEqual([
    { name: mainName, userId: userByName(initial, mainName)[0]!.id },
  ]);
  expect(sourceRow.teacherHints).toContainEqual({ name: reusedName, userId: userByName(initial, reusedName)[0]!.id });
  expect(sourceRow.teacherHints.some((hint) => hint.name.startsWith('Вакансия'))).toBe(false);
  const assignable = await request.get(`${apiUrl}/api/assignable-teachers`, { headers });
  expect(assignable.status()).toBe(200);
  expect((await assignable.json()).some((user: { id: number }) => user.id === card.id)).toBe(true);

  const apply = (data: Record<string, unknown>) => request.post(`${apiUrl}/api/complects/sync/apply`, { headers,
    data: { complectId: id, selections: [], ...data } });
  // Legacy apply может менять план offline, но не создавать людей из client incoming.
  const pendingRaw = raw('Неизменившаяся строка карточек', [unchangedName]);
  const pendingIncoming = { department: pendingRaw.division, ...pendingRaw, zet: 1, place: 'обязательной части' };
  expect((await apply({ selections: [{ action: 'add', incoming: pendingIncoming }] })).status()).toBe(200);
  expect(userByName(snapshot([id]), unchangedName)).toEqual([]);
  const fullSource = [raw(source[0]!.discipline, [...source[0]!.teachers, reusedName, excludedName]), pendingRaw];
  const beforePreview = snapshot([id]);
  const loaded = preview(id, fullSource);
  expect(snapshot([id])).toEqual(beforePreview);
  expect(loaded.diff.unchanged.some((row) => row.incoming.discipline === pendingRaw.discipline)).toBe(true);
  const updated = loaded.diff.updated[0]!;
  const applied = await apply({ teacherImportManifest: loaded.teacherImportManifest,
    selections: [{ action: 'update', id_1c: updated.id_1c, incoming: updated.incoming, fields: ['zet'] }] });
  expect(applied.status()).toBe(200);
  const result = await applied.json();
  expect(result.teacherImport.created).toBe(2);
  expect(result.teacherImport.unresolved).toEqual(expect.arrayContaining([
    { name: ambiguousName, reason: 'ambiguous' }, { name: inactiveName, reason: 'unavailable' },
  ]));
  const afterApply = snapshot([id]);
  expect(userByName(afterApply, unchangedName)).toHaveLength(1);
  expect(userByName(afterApply, excludedName)).toHaveLength(1);
  expect(afterApply.exchange.find((row) => row.id === updated.id_1c)!.teachers).toEqual(source[0]!.teachers);
  expect(afterApply.participants).toEqual([]);

  const importOnlyRaw = raw('Только импорт карточки без изменений плана', [onlyImportName]);
  const importOnlyIncoming = { ...importOnlyRaw, department: importOnlyRaw.division, zet: 1, place: 'обязательной части' };
  expect((await apply({ selections: [{ action: 'add', incoming: importOnlyIncoming }] })).status()).toBe(200);
  const unchangedSource = [...source, pendingRaw, importOnlyRaw];
  const importOnly = preview(id, unchangedSource);
  expect(importOnly.diff.updated).toEqual([]);
  expect(importOnly.diff.new).toEqual([]);
  const importOnlyApplied = await apply({ teacherImportManifest: importOnly.teacherImportManifest });
  expect(importOnlyApplied.status()).toBe(200);
  expect((await importOnlyApplied.json()).teacherImport.created).toBe(1);
  const repeated = await apply({ teacherImportManifest: importOnly.teacherImportManifest });
  expect(repeated.status()).toBe(200);
  expect((await repeated.json()).teacherImport.created).toBe(0);

  const invalidPreview = preview(id, [...unchangedSource, raw('Откат batch карточек', [rollbackName])]);
  const expired = preview(id, unchangedSource, 'expiredPreview');
  const second = driver<{ ids: number[] }>({ operation: 'concurrency', source: [raw('Concurrent карточки', [concurrentName])] });
  const concurrent = snapshot(second.ids);
  expect(userByName(concurrent, concurrentName)).toHaveLength(1);
  expect(concurrent.participants).toEqual([]);
  const otherHeaders = await headersFor(request, 'cards-rop');
  // Даём актору доступ к тому же комплекту: 422 должен быть именно binding, а не 403.
  expect((await request.put(`${apiUrl}/api/complects/${id}/owners`, { headers, data: {
    userIds: [userByName(initial, ropName)[0]!.id], baseUserIds: [actorId],
  } })).status()).toBe(200);
  const invalidIds = [id, ...second.ids];
  const invalidStart = snapshot(invalidIds);
  for (const manifest of [null, '', `${invalidPreview.teacherImportManifest}x`, expired.teacherImportManifest]) {
    expect((await apply({ teacherImportManifest: manifest })).status()).toBe(422);
    expect(snapshot(invalidIds)).toEqual(invalidStart);
  }
  const wrongActor = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers: otherHeaders,
    data: { complectId: id, selections: [], teacherImportManifest: invalidPreview.teacherImportManifest } });
  expect(wrongActor.status()).toBe(422);
  const wrongComplect = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers,
    data: { complectId: second.ids[0], selections: [], teacherImportManifest: invalidPreview.teacherImportManifest } });
  expect(wrongComplect.status()).toBe(422);
  expect(snapshot(invalidIds)).toEqual(invalidStart);
  const rollback = await apply({ teacherImportManifest: invalidPreview.teacherImportManifest,
    selections: [{ action: 'add', incoming: invalidPreview.diff.new[0]!.incoming }, { action: 'remove', id_1c: 2147483000 }] });
  expect(rollback.status()).toBe(404);
  expect(snapshot(invalidIds)).toEqual(invalidStart);
  expect(userByName(snapshot([id]), rollbackName)).toEqual([]);
  // Вставка произвольного incoming без подписи не даёт ему доверия для импорта.
  expect((await apply({ selections: [{ action: 'add', incoming: { ...pendingIncoming,
    discipline: 'Недоверенный client incoming', teachers: [forgedName] } }] })).status()).toBe(200);
  expect(userByName(snapshot([id]), forgedName)).toEqual([]);

  const partial = await request.put(`${apiUrl}/api/users/${card.id}`, { headers,
    data: { name: 'cards-real-login', role: 2, fullname: card.fullname } });
  expect(partial.status()).toBe(422);
  expect(userByName(snapshot([id]), twoPartName)[0]!.has_credentials).toBe(false);
  const passwordOnly = await request.put(`${apiUrl}/api/users/${card.id}`, { headers,
    data: { role: 2, fullname: card.fullname, password } });
  expect(passwordOnly.status()).toBe(422);
  const assigned = await request.put(`${apiUrl}/api/templates/${sourceRow.id_profile_template}/participants`, { headers,
    data: { teacherIds: [card.id], baseTeacherIds: [] } });
  expect(assigned.status()).toBe(200);
  const reloadedSourceRow = (await readRows()).find((row) =>
    row.id === sourceRow.id && row.id_profile_template === sourceRow.id_profile_template);
  expect(reloadedSourceRow?.participants).toMatchObject([{ userId: card.id }]);

  await signIn(page, 'admin');
  await page.getByText('Пользователи', { exact: true }).click();
  await filterColumn(page, 'ФИО', twoPartName);
  const cardRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: twoPartName, exact: true }) });
  await expect(cardRow).toContainText('Вход не настроен');
  await cardRow.getByRole('button', { name: 'Действия строки' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Вход не настроен');
  await expect(dialog.getByRole('textbox', { name: 'Отчество' })).toHaveValue('');
  await dialog.getByRole('textbox', { name: 'Логин' }).fill('cards-real-login');
  await dialog.getByLabel('Новый пароль').fill(password);
  const configured = page.waitForResponse((response) => response.url() === `${apiUrl}/api/users/${card.id}` && response.request().method() === 'PUT');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  expect((await configured).status()).toBe(200);
  await expect(dialog).toBeHidden();
  await expect(cardRow).toContainText('cards-real-login');
  const publicResponse = await request.get(`${apiUrl}/api/users`, { headers });
  const publicCard = (await publicResponse.json() as User[]).find((user) => user.id === card.id)!;
  expect(publicCard.has_credentials).toBe(true);
  expect(publicCard).not.toHaveProperty('password');
  driver({ operation: 'repeat', source }); // Включая настроенные credentials карточки.
  await page.getByRole('button', { name: 'Открыть меню аккаунта' }).click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await signInWithCredentials(page, 'cards-real-login', password);
  await expect(page).toHaveURL(/\/templates$/);
  const signedIn = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName: 'cards-real-login', password } });
  expect(signedIn.status()).toBe(200);
});
