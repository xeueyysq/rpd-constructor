import { describe, expect, it } from "vitest";
import { participantSubtext } from "./participantSubtext";

describe("подпись участия в комплекте", () => {
  it("сохраняет личную отметку, а неактивность добавляет в подтекст", () => {
    expect(participantSubtext({ state: "done", isActive: true })).toBe(
      "Готово"
    );
    expect(participantSubtext({ state: "assigned", isActive: false })).toBe(
      "Назначен (неактивен)"
    );
    expect(participantSubtext({ state: "in_progress", isActive: true })).toBe(
      "В работе"
    );
  });
});
