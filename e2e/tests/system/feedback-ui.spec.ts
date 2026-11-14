import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openComplect, password, signIn } from "../helpers.ts";
import { apiUrl } from "../helpers.ts";
import { headersFor, openFixtureComplect } from "../list3.ts";
import { openRowMenu } from "../teacherAssignments.ts";

const screenshotPath = new URL("../../../rpd-client-ts/public/docs/media/complect-table.png", import.meta.url).pathname;
const screenshot = readFileSync(screenshotPath);

test("ошибка отправки сохраняет заполненную форму и изображение до успешного повтора", async ({ page }) => {
  await signIn(page, "teacher");
  await page.getByRole("button", { name: "Сообщить о проблеме" }).click();
  const dialog = page.getByRole("dialog", { name: "Сообщить о проблеме" });
  const goal = dialog.getByRole("textbox", { name: "Что хотели сделать" });
  const actual = dialog.getByRole("textbox", { name: "Что получилось" });
  await goal.fill("Открыть шаблон дисциплины");
  await actual.fill("Не удалось сохранить изменения");
  await dialog.getByRole("checkbox", { name: "Не могу продолжить работу" }).check();
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: /прикрепить|добавить скриншот/i }).click();
  await (await chooser).setFiles(screenshotPath);
  await expect(dialog.getByRole("img", { name: /скриншот/i })).toBeVisible();

  let firstAttempt = true;
  await page.route("**/api/feedback", async (route) => {
    if (firstAttempt) {
      firstAttempt = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"temporarily unavailable"}' });
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: /отправить/i }).click();
  await expect(goal).toHaveValue("Открыть шаблон дисциплины");
  await expect(actual).toHaveValue("Не удалось сохранить изменения");
  await expect(dialog.getByRole("img", { name: /скриншот/i })).toBeVisible();

  const accepted = page.waitForResponse((response) => response.url().endsWith("/api/feedback") && response.status() === 201);
  await dialog.getByRole("button", { name: /отправить/i }).click();
  const receipt = await (await accepted).json() as { id: string; code: string };
  expect(receipt.code).toMatch(/^RPD-\d+$/);
  await expect(page.getByText(receipt.code, { exact: true })).toBeVisible();
});

test("вставленный скриншот показывается в форме и удаляется до отправки", async ({ page }) => {
  await signIn(page, "teacher");
  await page.getByRole("button", { name: "Сообщить о проблеме" }).click();
  const dialog = page.getByRole("dialog", { name: "Сообщить о проблеме" });
  await dialog.evaluate((element, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], "pasted.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }));
  }, Array.from(screenshot));
  await expect(dialog.getByRole("img", { name: /скриншот/i })).toBeVisible();
  await dialog.getByRole("button", { name: /удалить скриншот|убрать скриншот/i }).click();
  await expect(dialog.getByRole("img", { name: /скриншот/i })).toHaveCount(0);
});

test("обращение открывается поверх существующего окна, а детали доступны администратору", async ({ page, browser }) => {
  await signIn(page, "admin");
  await openComplect(page);
  await page.getByRole("button", { name: "Собрать ФОСы" }).click();
  const underlying = page.getByRole("dialog", { name: "Сформировать ФОС" });
  await expect(underlying).toBeVisible();
  await expect(page.getByRole("button", { name: "Сообщить о проблеме", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Сообщить о проблеме", exact: true }).click();
  const report = page.getByRole("dialog", { name: "Сообщить о проблеме" });
  await expect(report).toBeVisible();
  await report.getByRole("button", { name: "Отмена" }).click();
  await expect(report).not.toBeVisible();
  await expect(underlying).toBeVisible();
  await expect(page.getByRole("button", { name: "Сообщить о проблеме", exact: true })).toBeFocused();
  await expect(underlying.getByRole("button", { name: "Скачать Word" })).toBeVisible();
  await page.keyboard.press("Alt+Shift+P");
  await expect(report).toBeVisible();
  await report.getByRole("textbox", { name: "Что хотели сделать" }).fill("Сформировать ФОС из комплекта");
  await report.getByRole("textbox", { name: "Что получилось" }).fill("Документ не сформировался");
  const chooser = page.waitForEvent("filechooser");
  await report.getByRole("button", { name: /прикрепить|добавить скриншот/i }).click();
  await (await chooser).setFiles(screenshotPath);
  const accepted = page.waitForResponse((response) => response.url().endsWith("/api/feedback") && response.status() === 201);
  await report.getByRole("button", { name: /отправить/i }).click();
  const receipt = await (await accepted).json() as { id: string; code: string };
  await page.goto(`/feedback/${receipt.id}`);
  await expect(page.getByText("Сформировать ФОС из комплекта", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /скриншот/i })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: `Обращение ${receipt.code}`, exact: true })).toBeVisible();

  const guest = await browser.newPage();
  try {
    await guest.goto(`/feedback/${receipt.id}`);
    await expect(guest).toHaveURL(/\/sign-in/);
    await guest.getByRole("textbox", { name: "Имя пользователя" }).fill("admin");
    await guest.getByLabel("Пароль").fill(password);
    await guest.getByRole("button", { name: "Войти" }).click();
    await expect(guest).toHaveURL(new RegExp(`/feedback/${receipt.id}$`));
    await expect(guest.getByText("Сформировать ФОС из комплекта", { exact: true })).toBeVisible();
  } finally { await guest.close(); }

  const rop = await browser.newPage();
  try {
    await signIn(rop, "rop");
    await rop.goto(`/feedback/${receipt.id}`);
    await expect(rop.getByText("Сформировать ФОС из комплекта", { exact: true })).toHaveCount(0);
  } finally { await rop.close(); }
});

test("один глобальный контрол в обычной странице, single и Word; keyboard/focus, контекст дисциплины и возврат к комплекту", async ({ page, request }) => {
  test.slow();
  await signIn(page, "rop");
  await openFixtureComplect(page, 400);
  const trigger = page.getByRole("button", { name: "Сообщить о проблеме", exact: true });
  await expect(trigger).toHaveCount(1);
  const before = await trigger.boundingBox();
  expect(before!.x).toBeCloseTo(16, 0);
  await expect(page.locator(".MuiAppBar-root").getByRole("button", { name: "Сообщить о проблеме" })).toHaveCount(0);
  await trigger.click();
  const report = page.getByRole("dialog", { name: "Сообщить о проблеме", exact: true });
  await expect(trigger).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(report).toBeHidden();
  await expect(trigger).toBeFocused();

  await openRowMenu(page, page.getByRole("row").filter({ hasText: "Длинное название дисциплины для проверки импорта UI" }));
  await page.getByRole("menuitem", { name: "Импортировать", exact: true }).click();
  const single = page.getByRole("dialog", { name: "Импортировать данные РПД", exact: true });
  await expect(single.getByRole("radio").first()).toBeVisible();
  await expect(trigger).toHaveCount(1);
  const during = await trigger.boundingBox();
  expect(during!.x).toBeCloseTo(before!.x, 0);
  expect(during!.y).toBeCloseTo(before!.y, 0);
  const radio = single.getByRole("radio").first();
  await radio.check();
  await radio.focus();
  await page.keyboard.press("Alt+Shift+P");
  await expect(report).toBeVisible();
  await expect(report).toContainText("Длинное название дисциплины для проверки импорта UI");
  await page.keyboard.press("Escape");
  await expect(report).toBeHidden();
  await expect(radio).toBeFocused();
  await expect(radio).toBeChecked();
  for (let step = 0; step < 16; step++) {
    await page.keyboard.press(step % 2 ? "Shift+Tab" : "Tab");
    expect(await single.evaluate((paper) => paper.contains(document.activeElement))).toBe(true);
  }
  await trigger.click();
  await report.getByRole("textbox", { name: "Что хотели сделать" }).fill("Импортировать выбранную дисциплину");
  await report.getByRole("textbox", { name: "Что получилось" }).fill("Проверка контекста цели");
  const accepted = page.waitForResponse((response) => response.url().endsWith("/api/feedback") && response.status() === 201);
  await report.getByRole("button", { name: "Отправить обращение" }).click();
  const receipt = await (await accepted).json() as { id: string };
  const admin = await headersFor(request, "admin");
  const detail = await request.get(apiUrl + "/api/feedback/" + receipt.id, { headers: admin });
  expect(detail.status()).toBe(200);
  expect((await detail.json()).context).toMatchObject({ templateId: 4000, complectId: 400,
    discipline: "Длинное название дисциплины для проверки импорта UI" });
  await report.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(trigger).toBeFocused();
  await single.getByRole("button", { name: "Импортировать из Word", exact: true }).click();
  const word = page.getByRole("dialog", { name: "Импортировать из Word", exact: true });
  await expect(trigger).toHaveCount(1);
  await trigger.click();
  await expect(report).toBeVisible();
  await expect(report).toContainText("Длинное название дисциплины для проверки импорта UI");
  await page.keyboard.press("Escape");
  await expect(word).toBeVisible();
  await expect(trigger).toBeFocused();
  await word.getByRole("button", { name: "Отмена", exact: true }).click();
  await trigger.click();
  await expect(report).not.toContainText("Длинное название дисциплины для проверки импорта UI");
  await expect(report).toContainText("Комплект № 400");
});

test("ошибка загрузки страницы оставляет один глобальный контрол; свёрнутая панель и мобильное положение", async ({ page }) => {
  await signIn(page, "admin");
  // Реальный отказ ленивого модуля в dev, без тестовых флагов в приложении.
  await page.route("**/src/pages/feedback-detail/**", (route) => route.abort());
  await page.goto("/feedback/40000000-0000-4000-8000-000000000400");
  await expect(page.getByRole("heading", { name: "Не удалось показать страницу", exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: "Сообщить о проблеме", exact: true });
  await expect(trigger).toHaveCount(1);
  await page.getByRole("button", { name: "toggle drawer", exact: true }).click();
  for (const width of [1365, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(trigger).toHaveCount(1);
    const box = await trigger.boundingBox();
    expect(box!.x).toBeCloseTo(16, 0);
    expect(box!.width).toBeCloseTo(36, 0);
    expect(box!.y + box!.height).toBeCloseTo(828, 0);
    await trigger.focus();
    await page.keyboard.press("Alt+Shift+P");
    const report = page.getByRole("dialog", { name: "Сообщить о проблеме", exact: true });
    await expect(report).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(report).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});
