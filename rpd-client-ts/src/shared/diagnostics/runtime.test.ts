import { beforeEach, describe, expect, it, vi } from "vitest";
import { boundedContext, pathOnly, safeStack } from "./context";
import {
  addBreadcrumb,
  captureRuntimeError,
  freezeDiagnosticContext,
  resetDiagnostics,
  setDiagnosticEntity,
  setDiagnosticRoles,
  setDiagnosticRoute,
  setDiagnosticSender,
  setFeedbackAvailable,
} from "./runtime";

beforeEach(() => resetDiagnostics(1));

describe("безопасный диагностический контекст", () => {
  it("удаляет query и fragment, ограничивает историю и не переносит старую дисциплину на новый маршрут", () => {
    setDiagnosticRoles("1", "2", 1);
    setDiagnosticRoute("/templates/12/coverPage?token=secret", 1);
    setDiagnosticEntity(
      { templateId: 12, discipline: "Математика" },
      "/templates/12/coverPage",
      1
    );
    for (let i = 0; i < 40; i++)
      addBreadcrumb({
        at: new Date().toISOString(),
        kind: "action",
        operation: "template.save",
      });
    const old = freezeDiagnosticContext();
    expect(old.context).toMatchObject({
      route: "/templates/12/coverPage",
      templateId: 12,
      discipline: "Математика",
      primaryRole: "1",
      activeRole: "2",
    });
    expect(old.context.breadcrumbs).toHaveLength(30);
    setDiagnosticRoute("/templates/13/coverPage", 1);
    const current = freezeDiagnosticContext();
    expect(current.context.templateId).toBeUndefined();
    expect(current.context.discipline).toBeUndefined();
    expect(old.context.templateId).toBe(12);
    resetDiagnostics(2);
    expect(freezeDiagnosticContext().context.primaryRole).toBeUndefined();
    setDiagnosticEntity({ templateId: 99 }, "/templates/13/coverPage", 1);
    expect(freezeDiagnosticContext().context.templateId).toBeUndefined();
  });

  it("ограничивает размер и не пересылает неизвестные поля или текст ошибки", () => {
    const context = boundedContext({
      route: "/complects/12?key=secret",
      browser: "A".repeat(200),
      breadcrumbs: Array.from({ length: 30 }, (_, i) => ({
        at: new Date().toISOString(),
        kind: "action" as const,
        operation: "save",
        route: "/api/save?token=secret",
        requestBytes: i,
      })),
    });
    expect(context.route).toBe("/complects/12");
    expect(context.browser?.length).toBeLessThanOrEqual(120);
    expect(JSON.stringify(context)).not.toContain("secret");
    expect(pathOnly("//outside/path")).toBeUndefined();
    expect(
      safeStack(
        "Error: password=secret\n    at save (https://host/private/Editor.tsx:12:3)"
      )
    ).toBe("Error\n    at save (Editor.tsx:12:3)");
  });
});

it("ограничивает всплеск событий и не отправляет очередь прежней сессии", async () => {
  const sent: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  setDiagnosticSender(async (event) => {
    sent.push(event.clientEventId);
    if (sent.length === 1) await gate;
  });
  setFeedbackAvailable(true, 1);
  for (let i = 0; i < 100; i++) captureRuntimeError(new Error("private text"));
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  resetDiagnostics(2);
  release();
  await Promise.resolve();
  expect(sent).toHaveLength(1);
  setDiagnosticSender(async (event) => {
    sent.push(event.clientEventId);
  });
  setFeedbackAvailable(true, 2);
  for (let i = 0; i < 100; i++) captureRuntimeError(new Error("private text"));
  await vi.waitFor(() => expect(sent).toHaveLength(9));
});
