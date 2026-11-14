import { expect, test, type Page } from '@playwright/test';
import { apiUrl, signIn } from '../helpers';

const cases = [
  {
    level: 'Магистратура',
    faculty: 'Институт системного анализа и управления',
    direction: '09.04.03 Прикладная информатика (магистратура)',
    profile: 'Искусственный интеллект в системах управления',
  },
  {
    level: 'Бакалавриат',
    faculty: 'Инженерно физический институт',
    direction: '11.03.03 Конструирование и технология электронных средств',
    profile: 'Проектирование и технология интеллектуальных радиоэлектронных устройств ',
  },
] as const;

async function selectOption(page: Page, field: string, value: string) {
  const input = page.getByRole('combobox', { name: field });
  const open = input.locator('..').getByRole('button', { name: 'Open' });
  if (await open.isVisible()) await open.click();
  // Accessible names normalize whitespace; the outgoing JSON below verifies the raw value.
  await page.getByRole('option', { name: value.trimEnd(), exact: true }).click();
}

for (const { level, faculty, direction, profile } of cases) {
  test(`локальный каталог передаёт точные имена 1С в создание: ${direction}`, async ({ page }) => {
    const oneCRequests: string[] = [];
    await page.route('https://1c-api.uni-dubna.ru/**', async (route) => {
      oneCRequests.push(route.request().url());
      await route.abort();
    });

    const submitted: unknown[] = [];
    await page.route(`${apiUrl}/api/create_rpd_complect`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      submitted.push(route.request().postDataJSON());
      await route.fulfill({
        status: 422,
        json: { message: 'Синтетический отказ: комплект не создан' },
        headers: {
          'access-control-allow-origin': new URL(page.url()).origin,
          'access-control-allow-credentials': 'true',
        },
      });
    });

    await signIn(page, 'rop');
    const catalogResponse = page.waitForResponse((response) =>
      response.url() === `${apiUrl}/api/spec-profiles` && response.request().method() === 'GET');
    await page.goto('/manager');
    const catalog = await catalogResponse;
    expect(catalog.status()).toBe(200);
    expect((await catalog.json()).source).toBe('local');

    await selectOption(page, 'Выберите институт', faculty);
    await selectOption(page, 'Выберите уровень образования', level);
    await selectOption(page, 'Выберите направление обучения', direction);
    await selectOption(page, 'Выберите профиль обучения', profile);
    await selectOption(page, 'Выберите форму обучения', 'Очная');
    await selectOption(page, 'Выберите год набора', '2026');
    await page.getByRole('button', { name: 'Продолжить' }).click();

    const createResponse = page.waitForResponse((response) =>
      response.url() === `${apiUrl}/api/create_rpd_complect` && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Создать комплект' }).click();
    expect((await createResponse).status()).toBe(422);
    expect(submitted).toEqual([{
      data: {
        faculty,
        levelEducation: level,
        directionOfStudy: direction,
        profile,
        formEducation: 'Очная',
        year: '2026',
      },
    }]);
    expect(oneCRequests).toEqual([]);
  });
}
