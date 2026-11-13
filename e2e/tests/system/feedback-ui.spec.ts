import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openComplect, password, signIn } from "../helpers.ts";

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
  await underlying.getByRole("button", { name: "Сообщить о проблеме" }).click();
  const report = page.getByRole("dialog", { name: "Сообщить о проблеме" });
  await expect(report).toBeVisible();
  await report.getByRole("button", { name: "Отмена" }).click();
  await expect(report).not.toBeVisible();
  await expect(underlying).toBeVisible();
  await expect(underlying.getByRole("button", { name: "Сообщить о проблеме" })).toBeFocused();
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
