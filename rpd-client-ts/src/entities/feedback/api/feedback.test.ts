import { afterEach, beforeEach, expect, it } from "vitest";
import { axiosBase, beginSession, getSessionGeneration } from "@shared/api";
import { resetDiagnostics, setDiagnosticRoute } from "@shared/diagnostics";
import {
  createManualFeedbackDraft,
  getFeedbackDetail,
  submitManualFeedback,
} from "./feedback";

const originalAdapter = axiosBase.defaults.adapter;
beforeEach(() => {
  beginSession();
  resetDiagnostics(getSessionGeneration());
});
afterEach(() => {
  axiosBase.defaults.adapter = originalAdapter;
});

it("при чтении деталей оставляет только безопасный контекст и принимает пустое предупреждение", async () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  axiosBase.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: "OK",
    headers: {},
    data: {
      id,
      code: "RPD-42",
      type: "manual",
      createdAt: "2026-11-11T12:00:00.000Z",
      actorId: 7,
      requestId: null,
      goal: "Цель",
      actual: "Ошибка",
      blocking: false,
      warning: null,
      context: {
        route: "/templates/12?secret=token",
        editorContent: "private",
      },
    },
  });
  const detail = await getFeedbackDetail(id);
  expect(detail.warning).toBeNull();
  expect(detail.context.route).toBe("/templates/12");
  expect(JSON.stringify(detail.context)).not.toContain("private");
});
it("отправляет бинарный multipart с фиксированным контекстом и прежним ID при повторе", async () => {
  setDiagnosticRoute("/templates/12?token=secret", getSessionGeneration());
  const draft = createManualFeedbackDraft();
  setDiagnosticRoute("/templates/13", getSessionGeneration());
  const bodies: string[] = [];
  const screenshot = new File(
    [new Uint8Array([137, 80, 78, 71])],
    "screen.png",
    { type: "image/png" }
  );
  axiosBase.defaults.adapter = async (config) => {
    expect(config.data).toBeInstanceOf(FormData);
    expect(config.headers.toJSON()).not.toHaveProperty("Content-Type");
    const payload = (config.data as FormData).get("payload");
    expect(typeof payload).toBe("string");
    const image = (config.data as FormData).get("screenshot");
    expect(image).toBeInstanceOf(File);
    expect((image as File).size).toBe(4);
    bodies.push(String(payload));
    return {
      config,
      data: { id: "123e4567-e89b-42d3-a456-426614174000", code: "RPD-42" },
      status: 201,
      statusText: "Created",
      headers: {},
    };
  };
  const input = {
    ...draft,
    goal: "Сохранить",
    actual: "Ошибка",
    blocking: false,
    screenshot,
  };
  expect(await submitManualFeedback(input)).toMatchObject({ code: "RPD-42" });
  expect(await submitManualFeedback(input)).toMatchObject({ code: "RPD-42" });
  expect(bodies[0]).toBe(bodies[1]);
  expect(bodies[0]).toContain("/templates/12");
  expect(bodies[0]).not.toContain("secret");
});
