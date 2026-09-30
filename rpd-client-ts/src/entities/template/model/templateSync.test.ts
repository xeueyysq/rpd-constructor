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

  it("оставляет черновик грязным и не отмечает сохранение при ошибке", async () => {
    const revision = useTemplateSync.getState().markDirty("comment:goals");
    await expect(
      useTemplateSync
        .getState()
        .track(Promise.reject(new Error("Ошибка сервера")))
    ).rejects.toThrow("Ошибка сервера");
    expect(useTemplateSync.getState().pending).toBe(0);
    expect(useTemplateSync.getState().savedAt).toBeNull();
    expect(useTemplateSync.getState().dirty["comment:goals"]).toBe(revision);
    useTemplateSync.getState().clearDirty("comment:goals");
    expect(useTemplateSync.getState().dirty).toEqual({});
  });

  it("ответ старого шаблона не меняет статус после сброса", async () => {
    let finish!: () => void;
    useTemplateSync.getState().markDirty("goals");
    const request = useTemplateSync.getState().track(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    useTemplateSync.getState().reset();
    finish();
    await request;
    expect(useTemplateSync.getState().pending).toBe(0);
    expect(useTemplateSync.getState().savedAt).toBeNull();
    expect(useTemplateSync.getState().dirty).toEqual({});
  });
});
