import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { useTemplateSync } from "../model/templateSync";
import {
  useClearTemplateControl,
  useCopyTemplateContent,
  useCopyTemplateField,
  useImportComplect,
  useImportFieldPreview,
  useImportSources,
} from "./templateImport";
import { useSetTemplateParticipants, useTemplateWorkflow } from "./workflow";
import { useUpdateTemplateField } from "./updateTemplateField";
import type { TemplateWorkflow } from "../model/workflow";

// Настоящие React/Query хуки и Axios serialization; внешняя граница — HTTP adapter.
// SSR не проверяет DOM-события и effects: эти сценарии остаются браузерному пакету.
const originalAdapter = axiosBase.defaults.adapter;
let client: QueryClient;
let requests: InternalAxiosRequestConfig[];
let reply: (config: InternalAxiosRequestConfig) => unknown;
const before = "2026-11-01T10:00:00Z";
const edit = {
  userId: 7,
  fullname: "Иванова А.А.",
  at: "2026-11-01T11:00:00Z",
};
const content = {
  "0": { theme: "Тема", control: 2, lectures: 4 },
  __attestation__: { theme: "Экзамен", control: 36 },
};

function renderHook<T>(hook: () => T): T {
  let result!: T;
  function Harness() {
    result = hook();
    return null;
  }
  renderToStaticMarkup(
    createElement(QueryClientProvider, {
      client,
      children: createElement(Harness),
    })
  );
  return result;
}
function body(config: InternalAxiosRequestConfig): unknown {
  return JSON.parse(config.data as string);
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  requests = [];
  reply = () => ({});
  axiosBase.defaults.adapter = async (config) => {
    requests.push(config);
    return {
      data: await reply(config),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  useTemplateSync.getState().reset();
  useStore.getState().setJsonData({
    id: 12,
    id_rpd_complect: 5,
    direction: "Информатика",
    profile: "Системы",
    comments: { goals: "Комментарий" },
    content,
    goals: "Старые цели",
    field_edits: {
      goals: { ...edit, at: before },
      content: { ...edit, at: before },
    },
  });
});
afterEach(() => {
  axiosBase.defaults.adapter = originalAdapter;
  client.clear();
});

describe("HTTP-контракты клиентского импорта", () => {
  it("открывает каталог после полного завершения очереди сохранения, включая снятие dirty", async () => {
    let finish!: (value: unknown) => void;
    reply = (config) =>
      config.method === "put"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : { targetRevision: "after-save", complects: [] };
    const saved = renderHook(useUpdateTemplateField)(
      "goals",
      "Сохранённые цели"
    );
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    const sources = renderHook(() =>
      useImportSources({ targetTemplateId: 12 })
    ).refetch();
    expect(useTemplateSync.getState().dirty.goals).toBeDefined();
    finish({ field: "goals", value: "Сохранённые цели", edit });
    await saved;
    expect((await sources).data?.targetRevision).toBe("after-save");
    expect(useTemplateSync.getState().dirty).toEqual({});
  });
  it("получает import-only каталог с контекстом цели, preview передаёт повторённые ids и литературу", async () => {
    reply = () => ({ targetRevision: "opaque-revision", complects: [] });
    const sources = await renderHook(() =>
      useImportSources({ targetTemplateId: 12 })
    ).refetch();
    expect(sources.data?.targetRevision).toBe("opaque-revision");
    expect(
      new URL(
        axiosBase.getUri(requests[0]),
        "http://localhost"
      ).searchParams.get("targetTemplateId")
    ).toBe("12");
    expect(requests[0].url).toBe("template-import/sources");
    reply = () => [
      {
        id: 21,
        public_id: "source",
        textbook: ["Первая книга", "Вторая книга"],
      },
    ];
    const preview = await renderHook(() =>
      useImportFieldPreview([21, 22], "textbook", 12, true)
    ).refetch();
    const query = new URL(axiosBase.getUri(requests[1]), "http://localhost")
      .searchParams;
    expect(query.getAll("ids")).toEqual(["21", "22"]);
    expect(query.get("targetTemplateId")).toBe("12");
    expect(query.get("rowName")).toBe("textbook");
    expect(preview.data?.[0].textbook).toEqual([
      "Первая книга",
      "Вторая книга",
    ]);
  });

  it("дожидается сохранения цели и отправляет зафиксированный baseAt, сохраняя тип text[]", async () => {
    let finish!: () => void;
    const saving = useTemplateSync.getState().track(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    reply = () => ({ success: true, value: ["Новая книга"], edit });
    const mutation = renderHook(useCopyTemplateField);
    const imported = mutation.mutateAsync({
      sourceTemplateId: 21,
      targetTemplateId: 12,
      fieldToCopy: "textbook",
      baseAt: before,
    });
    await Promise.resolve();
    expect(requests).toHaveLength(0);
    finish();
    await saving;
    await imported;
    expect(body(requests[0])).toEqual({
      sourceTemplateId: 21,
      targetTemplateId: 12,
      fieldToCopy: "textbook",
      baseAt: before,
    });
    expect(useStore.getState().jsonData.textbook).toEqual(["Новая книга"]);
    expect(useStore.getState().jsonData.field_edits.textbook).toEqual(edit);
    expect(useTemplateSync.getState().dirty).toEqual({});
  });

  it("не очищает локальный черновик и не отправляет clear, пока есть несохранённое содержание", async () => {
    useTemplateSync.getState().markDirty("content");
    await expect(
      renderHook(useClearTemplateControl).mutateAsync({
        templateId: 12,
        rowId: "0",
        baseAt: before,
      })
    ).rejects.toThrow("Сначала сохраните");
    expect(requests).toHaveLength(0);
    expect(useTemplateSync.getState().dirty.content).toBeDefined();
    expect(useStore.getState().jsonData.content).toEqual(content);
  });

  it("clear получает актуальное содержание при 409, не повторяет POST и оставляет прочие поля", async () => {
    const remote = {
      ...content,
      "0": { ...content["0"], theme: "Правка коллеги" },
    };
    reply = (config) => {
      const response: AxiosResponse = {
        status: 409,
        statusText: "Conflict",
        headers: {},
        config,
        data: {
          status: 409,
          error: { message: "Конфликт", field: "content", value: remote, edit },
        },
      };
      throw new AxiosError(
        "Conflict",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        response
      );
    };
    await expect(
      renderHook(useClearTemplateControl).mutateAsync({
        templateId: 12,
        rowId: "0",
        baseAt: before,
      })
    ).rejects.toBeInstanceOf(AxiosError);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("templates/12/content-control/clear");
    expect(body(requests[0])).toEqual({ rowId: "0", baseAt: before });
    expect(useStore.getState().jsonData.content).toEqual(remote);
    expect(useStore.getState().jsonData.field_edits.content).toEqual(edit);
    expect(useStore.getState().jsonData.goals).toBe("Старые цели");
    expect(useTemplateSync.getState().dirty).toEqual({});
  });

  it("полный импорт передаёт исходную ревизию и объединяет ответ с join-метаданными цели", async () => {
    reply = () => ({
      success: true,
      targetRevision: "next",
      targetTemplate: {
        id: 12,
        goals: "Новые цели",
        content,
        assessment_tools_questions: { controlQuestions: "ФОС цели" },
        field_edits: { goals: edit },
      },
    });
    await renderHook(useCopyTemplateContent).mutateAsync({
      sourceTemplateId: 21,
      targetTemplateId: 12,
      targetRevision: "catalog-baseline",
    });
    expect(body(requests[0])).toEqual({
      sourceTemplateId: 21,
      targetTemplateId: 12,
      targetRevision: "catalog-baseline",
    });
    expect(useStore.getState().jsonData).toMatchObject({
      goals: "Новые цели",
      direction: "Информатика",
      profile: "Системы",
      comments: { goals: "Комментарий" },
      assessment_tools_questions: { controlQuestions: "ФОС цели" },
    });
  });

  it("bulk передаёт комплект и revision без собственного ослабления совпадений, сохраняет причины пропусков", async () => {
    reply = () => ({
      targetRevision: "next",
      imported: [],
      skipped: [
        {
          targetExchangeId: 80,
          targetTemplateId: 120,
          discipline: "Математика",
          semester: 4,
          record_type: "discipline",
          reason: "missing_source",
        },
      ],
      counts: { imported: 0, skipped: 1, total: 1 },
    });
    const result = await renderHook(useImportComplect).mutateAsync({
      sourceComplectId: 2,
      targetComplectId: 5,
      targetRevision: "bulk-baseline",
    });
    expect(requests[0].url).toBe("template-import/complect");
    expect(body(requests[0])).toEqual({
      sourceComplectId: 2,
      targetComplectId: 5,
      targetRevision: "bulk-baseline",
    });
    expect(result.counts).toEqual({ imported: 0, skipped: 1, total: 1 });
    expect(result.skipped[0]).toMatchObject({
      semester: 4,
      reason: "missing_source",
    });
  });

  it("Apply заменяет полный набор одним PUT и обновляет workflow cache, включая неактивного участника baseline", async () => {
    const snapshot: TemplateWorkflow = {
      templateId: 12,
      status: "on_teacher",
      statusChangedAt: null,
      participants: [
        {
          userId: 8,
          fullname: "Новый преподаватель",
          state: "assigned",
          isActive: true,
          updatedAt: edit.at,
        },
      ],
      progress: { done: 0, total: 1 },
      allowedActions: [],
      canEditTeachers: true,
    };
    reply = () => snapshot;
    await renderHook(useSetTemplateParticipants).mutateAsync({
      templateId: 12,
      teacherIds: [8],
      baseTeacherIds: [7, 9],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("put");
    expect(requests[0].url).toBe("templates/12/participants");
    expect(body(requests[0])).toEqual({
      teacherIds: [8],
      baseTeacherIds: [7, 9],
    });
    expect(renderHook(() => useTemplateWorkflow(12)).data).toEqual(snapshot);
  });
});
