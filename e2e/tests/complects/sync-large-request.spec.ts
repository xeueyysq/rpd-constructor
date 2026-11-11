import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { expect, test } from '@playwright/test';
import { apiUrl } from '../helpers';

const oldDepartment = 'Кафедра учебной аналитики';
const newDepartment = 'Кафедра прикладных информационных технологий';
const studyLoad = {
  'Всего часов': 144, 'Контактная работа всего': 72, 'Лекции': 18,
  'Практические занятия': 18, 'Лабораторные занятия': 18, 'Семинарские занятия': 18,
  'Самостоятельная работа': 72, 'Подготовка к практическим занятиям': 12,
  'Подготовка к лабораторным занятиям': 12, 'Индивидуальные консультации': 8,
  'Контроль самостоятельной работы': 4, 'Промежуточная аттестация': 36,
};

type Incoming = { discipline: string; department: string; teachers: string[]; [key: string]: unknown };
type Preview = { teacherImportManifest: string; diff: { updated: {
  id_1c: number; incoming: Incoming; fields: { field: string }[] }[] } };
type State = {
  complects: { id: number; has_pending_changes: boolean }[];
  owners: { user_id: number }[];
  exchange: { id: number; department: string; teachers: string[]; [key: string]: unknown }[];
  profiles: { id: number; department: string; goals: string; content: unknown; field_edits: unknown;
    [key: string]: unknown }[];
  statuses: { id_1c_template: number; id_profile_template: number; current_status: string }[];
  participants: { user_id: number; template_id: number; state: string }[];
  syncLog: { id: number; user_id: number }[];
  changes: { sync_log_id: number; field_key: string }[];
  users: { id: number; role: number }[];
  cards: { label_key: string; user_id: number }[];
};

function driver<T>(command: Record<string, unknown>): T {
  const env = parseEnv(readFileSync(new URL('../../e2e.env', import.meta.url), 'utf8'));
  const path = fileURLToPath(new URL('../../../rpd-server/tests/integration/syncLargeRequest.ts', import.meta.url));
  const output = execFileSync('node', [path], { env: { ...process.env, ...env },
    input: JSON.stringify(command), encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(output) as T;
}

test('полный план больше 100 KiB применяется и сохраняет РПД, а запрос больше 1 MiB отвергается', async ({ request }) => {
  test.setTimeout(240_000);
  const runId = randomUUID();
  const unique = [...runId.replaceAll('-', '').slice(0, 10)]
    .map((digit) => 'АБВГДЕЖЗИЙКЛМНОП'[parseInt(digit, 16)]).join('');
  const teacherNames = 'АБВГДЕЖЗИЙ'.split('').map((letter) =>
    `Синтетиков${unique}${letter} Проверочный Преподавательевич`);
  const source = Array.from({ length: 92 }, (_, index) => ({
    discipline: `Синтетическая дисциплина ${index + 1} ${runId}`,
    division: oldDepartment, semester: 1, record_type: '1.О',
    teachers: index === 0 ? [teacherNames[0]] : [],
    study_load: studyLoad, control_load: { 'Экзамен': 36, 'Курсовая работа': 18 },
  }));
  const changedSource = source.map((row, index) => ({ ...row, division: newDepartment,
    teachers: [teacherNames[index % 10], teacherNames[(index + 1) % 10], teacherNames[(index + 2) % 10]] }));
  const command = { runId, teacherNames };
  try {
    const { id, actorId, token } = driver<{ id: number; actorId: number; token: string }>(
      { ...command, operation: 'create', source });
    const state = () => driver<State>({ ...command, operation: 'state', complectId: id });
    const headers = { Authorization: `Bearer ${token}` };
    const before = state();
    expect(before.exchange).toHaveLength(92);
    expect(before.profiles).toHaveLength(92);
    expect(before.owners.map((owner) => owner.user_id)).toEqual([actorId]);
    expect(before.participants).toHaveLength(1);
    expect(before.statuses.some((row) => row.current_status === 'in_progress')).toBe(true);
    expect(before.profiles.some((row) => row.goals === '<p>Авторское содержание синтетической РПД</p>')).toBe(true);

    const preview = driver<Preview>({ ...command, operation: 'preview', complectId: id, source: changedSource });
    expect(state()).toEqual(before);
    expect(preview.diff.updated).toHaveLength(92);
    expect(preview.diff.updated.every((row) => ['department', 'teachers'].every((field) =>
      row.fields.some((change) => change.field === field)))).toBe(true);
    const selections = preview.diff.updated.map((row) => ({ action: 'update', id_1c: row.id_1c,
      incoming: row.incoming, fields: ['department', 'teachers'] }));
    const body = { complectId: id, selections, teacherImportManifest: preview.teacherImportManifest };
    const bytes = Buffer.byteLength(JSON.stringify(body));
    expect(bytes).toBeGreaterThan(102_400);
    expect(bytes).toBeLessThan(1024 * 1024);

    const anonymous = await request.post(`${apiUrl}/api/complects/sync/apply`, {
      data: { complectId: id, selections: [] } });
    expect(anonymous.status()).toBe(401);
    expect(state()).toEqual(before);
    const applied = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers, data: body, timeout: 90_000 });
    expect(applied.status()).toBe(200);
    const after = state();
    expect(after.exchange).toHaveLength(92);
    expect(after.profiles).toHaveLength(92);
    expect(after.owners).toEqual(before.owners);
    expect(after.statuses).toEqual(before.statuses);
    expect(after.participants).toEqual(before.participants);
    const exchangeWithoutSelections = ({ department, teachers, ...row }: State['exchange'][number]) => {
      void department; void teachers;
      return row;
    };
    const profileWithoutSelections = ({ department, field_edits, ...row }: State['profiles'][number]) => {
      void department; void field_edits;
      return row;
    };
    expect(after.exchange.map(exchangeWithoutSelections)).toEqual(before.exchange.map(exchangeWithoutSelections));
    expect(after.profiles.map(profileWithoutSelections)).toEqual(before.profiles.map(profileWithoutSelections));
    for (const selection of selections) {
      const exchange = after.exchange.find((row) => row.id === selection.id_1c);
      expect(exchange).toMatchObject({ department: newDepartment, teachers: selection.incoming.teachers });
      const status = after.statuses.find((row) => row.id_1c_template === selection.id_1c);
      expect(after.profiles.find((row) => row.id === status?.id_profile_template)?.department).toBe(newDepartment);
    }
    expect(after.users.filter((user) => user.role === 2)).toHaveLength(10);
    expect(after.cards).toHaveLength(10);
    expect(after.cards.every((card) => card.user_id !== null)).toBe(true);
    expect(after.syncLog).toHaveLength(1);
    expect(after.syncLog[0].user_id).toBe(actorId);
    expect(after.changes).toHaveLength(184);
    expect(after.complects[0].has_pending_changes).toBe(true);

    const repeated = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers, data: body, timeout: 90_000 });
    expect(repeated.status()).toBe(200);
    const afterRepeat = state();
    expect(afterRepeat.users).toEqual(after.users);
    expect(afterRepeat.cards).toEqual(after.cards);
    expect(afterRepeat.statuses).toEqual(after.statuses);
    expect(afterRepeat.participants).toEqual(after.participants);

    const oversized = { ...body, selections: Array.from({ length: 10 }, () => selections).flat() };
    expect(Buffer.byteLength(JSON.stringify(oversized))).toBeGreaterThan(1024 * 1024);
    const tooLarge = await request.post(`${apiUrl}/api/complects/sync/apply`, { headers, data: oversized });
    expect(tooLarge.status()).toBe(413);
    expect(state()).toEqual(afterRepeat);

    const ordinaryRoute = await request.post(`${apiUrl}/api/complects/sync/preview`, { headers, data: body });
    expect(ordinaryRoute.status()).toBe(413);
    expect(state()).toEqual(afterRepeat);
  } finally {
    driver({ ...command, operation: 'cleanup' });
  }
});
