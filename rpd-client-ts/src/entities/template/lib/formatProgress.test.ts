import { expect, test } from "vitest";
import { formatProgress } from "./formatProgress";

test("форматирует прогресс активных участников", () => {
  expect(formatProgress({ done: 2, total: 3 })).toBe("2/3 готовы");
  expect(formatProgress({ done: 0, total: 0 })).toBe("0/0 готовы");
});
