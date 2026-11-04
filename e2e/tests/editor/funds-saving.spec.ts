import { expect, test, type Locator, type Page } from '@playwright/test';
import { apiUrl, signIn } from '../helpers';
import { headersFor, list3, profileFor, templateFromDb } from '../list3';

function fundsSave(page: Page) {
  return page.waitForResponse((response) => response.url() === `${apiUrl}/api/update-json-value/317`
    && response.request().method() === 'PUT'
    && response.request().postDataJSON().fieldToUpdate === 'assessment_tools_questions');
}

async function savedValue(responsePromise: ReturnType<typeof fundsSave>) {
  const response = await responsePromise;
  expect(response.status(), 'ФОС должен сохраниться настоящим PUT после blur/действия').toBe(200);
  const payload = response.request().postDataJSON();
  const result = await response.json();
  expect(result.field).toBe('assessment_tools_questions');
  expect(result.value).toEqual(payload.value);
  return result.value;
}

async function typeAndBlur(page: Page, input: Locator, text: string) {
  await input.fill(text);
  const saved = fundsSave(page);
  await input.blur(); // Настоящий DOM FocusEvent: регрессия старого onBlur={payloadSave}.
  return savedValue(saved);
}

test('ФОС: пять blur-сохранений, add/select/remove, текст и выбранные вопросы после отложенной карты/reload', async ({ page, request }, testInfo) => {
  test.slow(); // Последовательные реальные blur-save, добавление/удаление и два жизненных цикла страницы.
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
    testInfo.annotations.push({ type: 'pageerror', description: error.message });
  });
  const headers = await headersFor(request, 'teacher');
  await signIn(page, 'teacher');
  await page.goto(`/templates/${list3.funds.publicId}/disciplineEvaluationsFunds`);
  const competence = page.getByRole('button', { name: list3.competence, exact: true });
  await competence.click();
  const openQuestion = page.locator('#q-text-open-list3-open');
  const openAnswer = page.locator('#q-answer-open-list3-open');
  const closedQuestion = page.locator('#q-text-closed-list3-closed');
  const closedAnswer = page.locator('#q-answer-closed-list3-closed');
  const controls = page.getByRole('textbox', { name: 'Контрольные вопросы по экзамену/зачету', exact: true });
  const group = (data: { competencies: Record<string, unknown> }) => data.competencies[list3.competence];
  expect(group(await typeAndBlur(page, openQuestion, 'Открытый вопрос после ввода'))).toMatchObject({
    openPool: [{ id: 'list3-open', text: 'Открытый вопрос после ввода', correctAnswer: 'Открытый ответ цели' }],
  });
  expect(group(await typeAndBlur(page, openAnswer, 'Правильный открытый ответ'))).toMatchObject({
    openPool: [{ id: 'list3-open', text: 'Открытый вопрос после ввода', correctAnswer: 'Правильный открытый ответ' }],
  });
  expect(group(await typeAndBlur(page, closedQuestion, 'Закрытый вопрос после ввода'))).toMatchObject({
    closedPool: [{ id: 'list3-closed', text: 'Закрытый вопрос после ввода', correctAnswer: 'Закрытый ответ цели' }],
  });
  expect(group(await typeAndBlur(page, closedAnswer, 'Правильный закрытый ответ'))).toMatchObject({
    closedPool: [{ id: 'list3-closed', text: 'Закрытый вопрос после ввода', correctAnswer: 'Правильный закрытый ответ' }],
  });
  expect((await typeAndBlur(page, controls, 'Общие контрольные вопросы после ввода')).controlQuestions)
    .toBe('Общие контрольные вопросы после ввода');

  const openCard = openQuestion.locator('xpath=ancestor::div[.//button[@aria-label="Удалить вопрос"]][1]');
  const closedCard = closedQuestion.locator('xpath=ancestor::div[.//button[@aria-label="Удалить вопрос"]][1]');
  const openSelected = openCard.getByRole('checkbox');
  const closedSelected = closedCard.getByRole('checkbox');
  await expect(openSelected).toBeEnabled();
  let saved = fundsSave(page);
  await openSelected.check();
  expect(group(await savedValue(saved))).toMatchObject({ selectedOpenIds: ['list3-open'] });
  saved = fundsSave(page);
  await closedSelected.check();
  expect(group(await savedValue(saved))).toMatchObject({ selectedClosedIds: ['list3-closed'] });

  // Добавление и удаление сохраняются сразу и не стирают уже выбранные вопросы.
  saved = fundsSave(page);
  await page.getByRole('button', { name: 'Добавить вопрос', exact: true }).first().click();
  const addedData = await savedValue(saved);
  const openPool = addedData.competencies[list3.competence].openPool as Array<{ id: string; text: string }>;
  expect(openPool).toHaveLength(2);
  const addedId = openPool.find((question) => question.id !== 'list3-open')!.id;
  const addedQuestion = page.locator(`[id="q-text-open-${addedId}"]`);
  await expect(addedQuestion).toBeVisible();
  const addedCard = addedQuestion.locator('xpath=ancestor::div[.//button[@aria-label="Удалить вопрос"]][1]');
  const addedSelected = addedCard.getByRole('checkbox');
  // При доступной квоте добавление уже выбирает вопрос и сохраняет этот выбор.
  expect(group(addedData)).toMatchObject({ selectedOpenIds: ['list3-open', addedId] });
  await expect(addedSelected).toBeChecked();
  saved = fundsSave(page);
  await addedSelected.uncheck();
  expect(group(await savedValue(saved))).toMatchObject({ selectedOpenIds: ['list3-open'] });
  saved = fundsSave(page);
  await addedSelected.check();
  expect(group(await savedValue(saved))).toMatchObject({ selectedOpenIds: ['list3-open', addedId] });
  saved = fundsSave(page);
  await addedCard.getByRole('button', { name: 'Удалить вопрос', exact: true }).click();
  const finalValue = await savedValue(saved);
  expect(group(finalValue)).toMatchObject({ selectedOpenIds: ['list3-open'], selectedClosedIds: ['list3-closed'],
    openPool: [{ id: 'list3-open', text: 'Открытый вопрос после ввода', correctAnswer: 'Правильный открытый ответ' }] });
  await expect(addedQuestion).toHaveCount(0);
  expect((await profileFor(request, headers, list3.funds.id)).assessment_tools_questions).toEqual(finalValue);
  expect(templateFromDb(list3.funds.id).assessment_tools_questions).toEqual(finalValue);
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('fos-saved.png') });

  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/get-results-data?*', async (route) => {
    await held;
    await route.continue(); // Ответ остаётся настоящим; контролируем только порядок загрузки.
  });
  const mapRequested = page.waitForRequest((sent) => sent.url().includes('/api/get-results-data?'));
  const mapResponse = page.waitForResponse((response) => response.url().includes('/api/get-results-data?') && response.ok());
  try {
    await page.reload();
    await mapRequested;
    await competence.click();
    await expect(openQuestion).toHaveValue('Открытый вопрос после ввода');
    await expect(openSelected).toBeDisabled();
    // Pending-квота не равна нулевой разрешённой квоте.
    await expect(openSelected, 'Сохранённый выбор не должен исчезать до ответа карты').toBeChecked();
    await expect(closedSelected, 'Закрытый вопрос также остаётся выбранным при pending').toBeChecked();
  } finally {
    release();
  }
  expect((await mapResponse).status()).toBe(200);
  await expect(openSelected).toBeEnabled();
  await expect(closedSelected).toBeEnabled();
  await expect(openAnswer).toHaveValue('Правильный открытый ответ');
  await expect(closedQuestion).toHaveValue('Закрытый вопрос после ввода');
  await expect(closedAnswer).toHaveValue('Правильный закрытый ответ');
  await expect(controls).toHaveValue('Общие контрольные вопросы после ввода');
  await expect(openSelected, 'Выбор открытого вопроса должен сохраниться после reload').toBeChecked();
  await expect(closedSelected, 'Выбор закрытого вопроса должен сохраниться после reload').toBeChecked();
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('fos-reloaded-selection.png') });
  expect((await profileFor(request, headers, list3.funds.id)).assessment_tools_questions).toEqual(finalValue);
  expect(templateFromDb(list3.funds.id).assessment_tools_questions).toEqual(finalValue);

  // Ошибка и неизвестный формат карты также не разрешают менять сохранённый выбор.
  const mapUrl = '**/api/get-results-data?*';
  for (const reply of [
    { status: 503, json: { error: 'Синтетическая недоступность карты' } },
    { status: 200, json: { unavailable: true } },
  ]) {
    await page.unroute(mapUrl);
    await page.route(mapUrl, async (route) => {
      await route.fulfill({ response: await route.fetch(), ...reply });
    });
    const unavailable = page.waitForResponse((response) => response.url().includes('/api/get-results-data?')
      && response.status() === reply.status);
    await page.reload();
    await unavailable;
    await competence.click();
    await expect(openSelected).toBeDisabled();
    await expect(closedSelected).toBeDisabled();
    await expect(openSelected).toBeChecked();
    await expect(closedSelected).toBeChecked();
  }
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('fos-unavailable-selection.png') });
  expect((await profileFor(request, headers, list3.funds.id)).assessment_tools_questions).toEqual(finalValue);
  expect(templateFromDb(list3.funds.id).assessment_tools_questions).toEqual(finalValue);

  // Успешно полученная пустая карта — настоящая квота 0: прежняя политика clamp сохраняется.
  await page.unroute(mapUrl);
  await page.route(mapUrl, async (route) => {
    await route.fulfill({ response: await route.fetch(), json: [] });
  });
  const zeroQuota = page.waitForResponse((response) => response.url().includes('/api/get-results-data?') && response.ok());
  await page.reload();
  await zeroQuota;
  await competence.click();
  await expect(openSelected).toBeDisabled();
  await expect(closedSelected).toBeDisabled();
  await expect(openSelected).not.toBeChecked();
  await expect(closedSelected).not.toBeChecked();
  expect(pageErrors, 'Не должно быть RangeError или других необработанных JS ошибок').toEqual([]);
});
