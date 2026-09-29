import { beforeEach, describe, expect, it } from "vitest";
import { useTemplateSync } from "./templateSync";

describe("ревизии правок шаблона", () => {
  beforeEach(() => useTemplateSync.getState().reset());

  it("сохраняет грязное поле, если его изменили после начала сохранения", async () => {
    const first = useTemplateSync.getState().markDirty("content");
    let finish!: () => void;
    const request = useTemplateSync.getState().track(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    const second = useTemplateSync.getState().markDirty("content");
    expect(second).toBeGreaterThan(first);
    finish();
    await request;
    useTemplateSync.getState().clearDirty("content", first);
    expect(useTemplateSync.getState().dirty.content).toBe(second);
  });

  it("снимает флаг после сохранения без новых правок", async () => {
    const current = useTemplateSync.getState().markDirty("goals");
    await useTemplateSync.getState().track(Promise.resolve());
    useTemplateSync.getState().clearDirty("goals", current);
    expect(useTemplateSync.getState().dirty.goals).toBeUndefined();
  });
});
