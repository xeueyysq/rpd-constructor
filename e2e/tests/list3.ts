import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { apiUrl, password } from './helpers';

// Только синтетические строки e2e/seed.sql. Предсозданные источники тесты не изменяют.
export const list3 = {
  discipline: 'Импорт поля List3',
  competence: 'ПК-L3 Авторская компетенция',
  source: { id: 300, complectId: 300, profile: 'List3 Источники', publicId: 'a300a300a300' },
  oldSource: { id: 302, complectId: 301, publicId: 'a302a302a302' },
  fieldRop: { id: 310, complectId: 310, publicId: 'a310a310a310' },
  fieldTeacher: { id: 311, complectId: 311, publicId: 'a311a311a311' },
  full: { id: 312, complectId: 312, publicId: 'a312a312a312' },
  bulk: { id: 313, complectId: 313, publicId: 'a313a313a313' },
  control: { id: 316, complectId: 316, publicId: 'a316a316a316' },
  funds: { id: 317, complectId: 317, publicId: 'a317a317a317' },
  ropMode: { id: 318, complectId: 101, publicId: 'a318a318a318', discipline: 'Режим РОП-преподавателя List3' },
  fieldReopen: { id: 320, complectId: 320, publicId: 'a320a320a320', sourceComplectId: 321,
    owner: 'field-reopen-rop', discipline: 'Повторное открытие импорта List3' },
} as const;

export async function headersFor(request: APIRequestContext, userName = 'rop') {
  const auth = await request.post(`${apiUrl}/auth/sign-in`, { data: { userName, password } });
  expect(auth.status()).toBe(200);
  return { Authorization: `Bearer ${(await auth.json()).accessToken as string}` };
}

export async function profileFor(request: APIRequestContext, headers: Record<string, string>, id: number) {
  const response = await request.post(`${apiUrl}/api/rpd-profile-templates`, { headers, data: { id } });
  expect(response.status(), `Чтение сохранённой РПД ${id}`).toBe(200);
  return response.json();
}

// Чтение настоящей тестовой PostgreSQL; не подменяет API и не создаёт app seams.
// Исполняется только при host-запуске E2E, где reset-db.sh уже поднял этот контейнер.
export function templateFromDb(id: number): Record<string, unknown> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Нужен числовой ID тестовой РПД');
  const directory = fileURLToPath(new URL('../', import.meta.url));
  const env = parseEnv(readFileSync(new URL('../e2e.env', import.meta.url), 'utf8'));
  const json = execFileSync('docker', [
    'compose', '--env-file', 'e2e.env', 'exec', '-T', 'db',
    'psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', env.DB_USER!, '-d', env.DB_NAME!,
    '-c', `SELECT to_jsonb(t) || jsonb_build_object('teacher_ids', COALESCE(
      (SELECT jsonb_agg(tt.user_id ORDER BY tt.user_id) FROM teacher_templates tt WHERE tt.template_id=t.id), '[]'::jsonb))
      FROM rpd_profile_templates t WHERE id = ${id}`,
  ], { cwd: directory, encoding: 'utf8', timeout: 10_000 }).trim();
  expect(json, `РПД ${id} должна существовать в тестовой БД`).not.toBe('');
  return JSON.parse(json) as Record<string, unknown>;
}

export async function openFixtureComplect(page: Page, id: number) {
  // API поддерживает числовой ID комплекта; UUID этих seed-строк генерирует БД.
  const response = page.waitForResponse((result) => result.url().includes('/api/find-rpd')
    && result.request().method() === 'POST' && result.ok());
  await page.goto(`/complects/${id}`);
  await response;
  await expect(page.getByRole('row').filter({ has: page.getByRole('cell') }).first()).toBeVisible();
}

export function preservedImportData(profile: Record<string, unknown>) {
  return Object.fromEntries([
    'id', 'public_id', 'id_rpd_complect', 'disciplins_name', 'department', 'place', 'semester', 'zet',
    'certification', 'study_load', 'control_load', 'competencies',
    'assessment_tools_questions', 'assessment_tools_template',
  ].map((key) => [key, profile[key]]));
}
