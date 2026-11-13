import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  applySession,
  axiosBase,
  beginSession,
  endSession,
  SessionChangedError,
} from "@shared/api";
import { useStore } from "@shared/hooks";
import { useTemplateSync } from "../model/templateSync";
import {
  useClearTemplateControl,
  useCopyTemplateContent,
  useCopyTemplateField,
  useImportComplect,
  useImportFieldPreview,
  useImportCatalog,
  useImportSourceDetails,
  useImportSources,
  useWordImportApply,
  previewFile,
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
  beginSession();
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
  endSession();
  axiosBase.defaults.adapter = originalAdapter;
  client.clear();
});

describe("HTTP-контракты клиентского импорта", () => {
  it("ожидающий сохранения импорт A не отправляется после смены сессии на B", async () => {
    let finish!: () => void;
    const saving = useTemplateSync.getState().track(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    reply = () => ({ success: true, value: "Поздний импорт A", edit });
    const imported = renderHook(useCopyTemplateField).mutateAsync({
      sourceTemplateId: 21,
      targetTemplateId: 12,
      fieldToCopy: "goals",
      baseAt: before,
    });
    const result = Promise.allSettled([imported]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    applySession(
      {
        accessToken: "B",
        accessTokenExpiration: 10000,
        role: 3,
        fullname: { name: "B", surname: "", patronymic: "" },
      },
      beginSession()
    );
    useTemplateSync.getState().reset();
    useStore.getState().setJsonData({ id: 12, goals: "B" });
    finish();
    await saving;
    expect(await result).toEqual([
      { status: "rejected", reason: expect.any(SessionChangedError) },
    ]);
    expect(requests).toEqual([]);
    expect(useStore.getState().jsonData.goals).toBe("B");
  });

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

  it("запрашивает фильтры каталога до страницы и только выбранный комплект; смена сессии изолирует кеш", async () => {
    reply = (config) =>
      config.url === "template-import/catalog"
        ? {
            targetRevision: "rev-A",
            complects: [{ id: 21 }],
            page: 2,
            pageSize: 10,
            total: 12,
            facets: {
              faculties: ["ФИТ"],
              educationLevels: [],
              directions: [],
              profiles: [],
              educationForms: [],
              years: [],
            },
          }
        : {
            targetRevision: "rev-A",
            complects: [{ id: 21, templates: [{ id: 31, status: "ready" }] }],
          };
    const query = {
      targetTemplateId: 12,
      ownOnly: true,
      search: "Алгоритмы",
      status: "ready" as const,
      sourceMode: "other-year" as const,
      page: 2,
    };
    const catalog = await renderHook(() => useImportCatalog(query)).refetch();
    expect(catalog.data?.total).toBe(12);
    const catalogParams = new URL(
      axiosBase.getUri(requests[0]),
      "http://localhost"
    ).searchParams;
    expect(catalogParams.get("ownOnly")).toBe("true");
    expect(catalogParams.get("search")).toBe("Алгоритмы");
    expect(catalogParams.get("status")).toBe("ready");
    expect(catalogParams.get("sourceMode")).toBe("other-year");
    expect(catalogParams.get("page")).toBe("2");
    const details = await renderHook(() =>
      useImportSourceDetails({ ...query, sourceComplectId: 21 })
    ).refetch();
    expect(details.data?.complects[0].templates[0].status).toBe("ready");
    expect(
      new URL(
        axiosBase.getUri(requests[1]),
        "http://localhost"
      ).searchParams.get("sourceComplectId")
    ).toBe("21");
    beginSession();
    expect(renderHook(() => useImportCatalog(query)).data).toBeUndefined();
  });

  it("Word применяет выбранные поля и не записывает ответ в другой открытый редактор", async () => {
    let finish!: (value: unknown) => void;
    reply = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const pending = renderHook(useWordImportApply).mutateAsync({
      targetTemplateId: 12,
      expectedRevision: "word-rev",
      mode: "replace",
      selectedFields: ["goals"],
      values: { goals: "Новые цели", software: "Лишнее поле" },
    });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(body(requests[0])).toEqual({
      expectedRevision: "word-rev",
      mode: "replace",
      selectedFields: ["goals"],
      values: { goals: "Новые цели" },
    });
    useStore.getState().setJsonData({ id: 13, goals: "Редактор Б" });
    finish({
      success: true,
      targetRevision: "next",
      updatedFields: ["goals"],
      targetTemplate: { id: 12, goals: "Новые цели", field_edits: {} },
    });
    await expect(pending).rejects.toThrow("другая РПД");
    expect(useStore.getState().jsonData).toMatchObject({
      id: 13,
      goals: "Редактор Б",
    });
  });

  it("Word preview проверяет файл до HTTP и не возвращает ответ после смены сессии", async () => {
    await expect(previewFile(12, new File(["x"], "bad.txt"))).rejects.toThrow(
      ".docx"
    );
    expect(requests).toHaveLength(0);
    let finish!: (value: unknown) => void;
    reply = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const pending = previewFile(12, new File(["PK"], "rpd.docx"));
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].data).toBeInstanceOf(FormData);
    beginSession();
    finish({
      targetTemplateId: 12,
      targetRevision: "old",
      values: {},
      availableFields: [],
      warnings: [],
      source: {},
    });
    await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
  });

  it("Word preview и apply работают с фиксированной целью из списка без открытого редактора", async () => {
    useStore.getState().setJsonData({});
    reply = (request) =>
      request.url?.endsWith("/preview")
        ? {
            targetTemplateId: 12,
            targetRevision: "word-rev",
            values: { goals: "Новые цели" },
            availableFields: ["goals"],
            warnings: [],
            source: {},
          }
        : {
            success: true,
            targetRevision: "next",
            updatedFields: ["goals"],
            targetTemplate: { id: 12, goals: "Новые цели", field_edits: {} },
          };
    const preview = await previewFile(12, new File(["PK"], "rpd.docx"));
    expect(preview.targetRevision).toBe("word-rev");
    const applied = await renderHook(useWordImportApply).mutateAsync({
      targetTemplateId: 12,
      expectedRevision: preview.targetRevision,
      mode: "replace",
      selectedFields: ["goals"],
      values: preview.values,
    });
    expect(applied.updatedFields).toEqual(["goals"]);
    expect(useStore.getState().jsonData).toEqual({});
    expect(requests.map((request) => request.url)).toEqual([
      "templates/12/import-word/preview",
      "templates/12/import-word/apply",
    ]);
  });

  it("Word из списка не подменяет редактор, открытый во время ответа", async () => {
    useStore.getState().setJsonData({});
    let finish!: (value: unknown) => void;
    reply = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const pending = renderHook(useWordImportApply).mutateAsync({
      targetTemplateId: 12,
      expectedRevision: "word-rev",
      mode: "replace",
      selectedFields: ["goals"],
      values: { goals: "Новые цели" },
    });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    useStore.getState().setJsonData({ id: 13, goals: "Редактор Б" });
    finish({
      success: true,
      targetRevision: "next",
      updatedFields: ["goals"],
      targetTemplate: { id: 12, goals: "Новые цели", field_edits: {} },
    });
    await expect(pending).resolves.toMatchObject({ updatedFields: ["goals"] });
    expect(useStore.getState().jsonData).toMatchObject({
      id: 13,
      goals: "Редактор Б",
    });
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
