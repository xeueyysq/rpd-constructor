import { afterEach, describe, expect, it, vi } from "vitest";
import type { InternalAxiosRequestConfig } from "axios";
import { applySession, axiosBase, beginSession, endSession } from "@shared/api";
import { useStore } from "@shared/hooks";
import { useUpdateTemplateField, useTemplateSync } from "@entities/template";
import { saveStudyPlan } from "./studyPlan";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("@shared/lib", () => ({ showErrorMessage: vi.fn() }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

const adapter = axiosBase.defaults.adapter;
afterEach(() => {
  axiosBase.defaults.adapter = adapter;
  endSession();
  useTemplateSync.getState().reset();
  useStore.getState().setJsonData({});
});

describe.each(["field", "study-plan"] as const)("очередь %s", (kind) => {
  it("отбрасывает оставшиеся задания A и не задерживает сохранение B на той же РПД", async () => {
    const oldResponse = deferred();
    const newResponse = deferred();
    const requests: string[] = [];
    axiosBase.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const token = String(config.headers.get("Authorization"));
      requests.push(token);
      await (token === "Bearer A" ? oldResponse.promise : newResponse.promise);
      return {
        config,
        status: 200,
        statusText: "OK",
        headers: {},
        data: {
          field: "goals",
          value: token,
          edit: null,
          study_load: {},
          zet: 3,
          study_plan_hours: {},
          edits: {},
        },
      };
    };
    const login = (token: string) => {
      applySession(
        {
          accessToken: token,
          accessTokenExpiration: 10000,
          role: 3,
          fullname: { name: token, surname: "", patronymic: "" },
        },
        beginSession()
      );
      useTemplateSync.getState().reset();
      useStore.getState().setJsonData({ id: 12, goals: token });
    };
    const save =
      kind === "field"
        ? (value: number) => useUpdateTemplateField()("goals", value)
        : (value: number) => saveStudyPlan(12, { zet: value });
    login("A");
    const first = save(1);
    const second = save(2);
    const oldResults = Promise.allSettled([first, second]);
    await vi.waitFor(() => expect(requests).toEqual(["Bearer A"]));
    login("B");
    const current = save(3);
    // Снимок до освобождения A: B не должен ждать старой очереди.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const beforeOldResponse = [...requests];
    oldResponse.resolve();
    newResponse.resolve();
    await oldResults;
    await current;
    expect(beforeOldResponse).toEqual(["Bearer A", "Bearer B"]);
    expect(requests).toEqual(["Bearer A", "Bearer B"]);
    expect(useStore.getState().jsonData.goals).toBe(
      kind === "field" ? "Bearer B" : "B"
    );
  });
});
