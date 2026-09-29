import { describe, expect, it } from "vitest";
import { getTemplateStatusLabel } from "./getTemplateStatusLabel";

describe("getTemplateStatusLabel", () => {
  it("возвращает русскую метку известного статуса", () => {
    expect(getTemplateStatusLabel("in_progress")).toBe("В работе");
  });

  it("сохраняет неизвестный код", () => {
    expect(getTemplateStatusLabel("custom_status")).toBe("custom_status");
  });

  it.each(["", null, undefined])("возвращает пустую строку для %s", (code) => {
    expect(getTemplateStatusLabel(code)).toBe("");
  });
});
