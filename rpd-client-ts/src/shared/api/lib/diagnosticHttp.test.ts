import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AxiosError, CanceledError } from "axios";
import { axiosBase, beginSession, getSessionGeneration } from "..";
import {
  resetDiagnostics,
  setDiagnosticEntity,
  setDiagnosticRoute,
  setDiagnosticSender,
  setFeedbackAvailable,
  type DiagnosticEvent,
} from "@shared/diagnostics";

const originalAdapter = axiosBase.defaults.adapter;
beforeEach(() => {
  beginSession();
  resetDiagnostics(getSessionGeneration());
});
afterEach(() => {
  axiosBase.defaults.adapter = originalAdapter;
  setDiagnosticSender(undefined);
});

it("сбой сохранения использует контекст начала запроса и отбрасывается после смены сессии", async () => {
  const events: DiagnosticEvent[] = [];
  setDiagnosticSender(async (event) => {
    events.push(event);
  });
  setFeedbackAvailable(true, getSessionGeneration());
  setDiagnosticRoute("/templates/12/coverPage", getSessionGeneration());
  setDiagnosticEntity(
    { templateId: 12 },
    "/templates/12/coverPage",
    getSessionGeneration()
  );
  const failures: Array<() => void> = [];
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  axiosBase.defaults.adapter = (config) => {
    started();
    return new Promise((_resolve, reject) => {
      failures.push(() =>
        reject(
          new AxiosError(
            "private message",
            "ERR_BAD_RESPONSE",
            config,
            undefined,
            { config, data: {}, status: 500, statusText: "500", headers: {} }
          )
        )
      );
    });
  };
  const pending = axiosBase.put("update-json-value/12", {
    secret: "editor content",
  });
  const result = Promise.allSettled([pending]);
  await startedPromise;
  setDiagnosticRoute("/templates/13/coverPage", getSessionGeneration());
  failures[0]();
  await result;
  await vi.waitFor(() => expect(events).toHaveLength(1));
  expect(events[0].context.route).toBe("/templates/12/coverPage");
  expect(events[0].context.templateId).toBe(12);
  expect(JSON.stringify(events[0])).not.toContain("editor content");
  expect(JSON.stringify(events[0])).not.toContain("private message");

  const late = axiosBase.put("update-json-value/13", {
    secret: "late editor content",
  });
  const lateResult = Promise.allSettled([late]);
  await vi.waitFor(() => expect(failures).toHaveLength(2));
  beginSession();
  resetDiagnostics(getSessionGeneration());
  failures[1]();
  await lateResult;
  expect(events).toHaveLength(1);
});

it.each([
  {
    path: "templates/12/workflow",
    normalizedRoute: "/api/templates/:id/workflow",
    operation: "template.workflow",
    status: 500,
    axiosCode: "ERR_BAD_RESPONSE",
    errorCode: "http_error",
  },
  {
    path: "templates/12/content-control/clear",
    normalizedRoute: "/api/templates/:id/content-control/clear",
    operation: "template.save",
    status: 413,
    axiosCode: "ERR_BAD_RESPONSE",
    errorCode: "payload_too_large",
  },
  {
    path: "templates/12/workflow",
    normalizedRoute: "/api/templates/:id/workflow",
    operation: "template.workflow",
    status: undefined,
    axiosCode: "ERR_NETWORK",
    errorCode: "ERR_NETWORK",
  },
])(
  "POST $path при сбое $errorCode отправляет безопасную диагностику",
  async ({
    path,
    normalizedRoute,
    operation,
    status,
    axiosCode,
    errorCode,
  }) => {
    const events: DiagnosticEvent[] = [];
    setDiagnosticSender(async (event) => {
      events.push(event);
    });
    setFeedbackAvailable(true, getSessionGeneration());
    setDiagnosticRoute("/templates/12/coverPage", getSessionGeneration());
    setDiagnosticEntity(
      { templateId: 12 },
      "/templates/12/coverPage",
      getSessionGeneration()
    );
    const requestId = "123e4567-e89b-42d3-a456-426614174000";
    axiosBase.defaults.adapter = async (config) => {
      setDiagnosticRoute("/templates/99/coverPage", getSessionGeneration());
      throw new AxiosError(
        "private message",
        axiosCode,
        config,
        undefined,
        status === undefined
          ? undefined
          : {
              config,
              data: {},
              status,
              statusText: String(status),
              headers: {},
            }
      );
    };

    await expect(
      axiosBase.post(
        `${path}?token=private-query`,
        { comment: "private body" },
        {
          headers: { "X-Request-ID": requestId, "X-Private": "private-header" },
        }
      )
    ).rejects.toBeInstanceOf(AxiosError);
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({
      operation,
      errorCode,
      requestId,
      context: {
        route: "/templates/12/coverPage",
        templateId: 12,
      },
    });
    expect(events[0].status).toBe(status);
    expect(events[0].context.breadcrumbs).toContainEqual(
      expect.objectContaining({
        kind: "http",
        operation,
        method: "POST",
        route: normalizedRoute,
        status,
        requestId,
      })
    );
    const serialized = JSON.stringify(events[0]);
    for (const secret of [
      "private-query",
      "private body",
      "private-header",
      "private message",
    ])
      expect(serialized).not.toContain(secret);
  }
);

it("Word 413 и каталог 500 записывают только безопасный маршрут, без имени DOCX и текста поиска", async () => {
  const events: DiagnosticEvent[] = [];
  setDiagnosticSender(async (event) => {
    events.push(event);
  });
  setFeedbackAvailable(true, getSessionGeneration());
  axiosBase.defaults.adapter = async (config) => {
    throw new AxiosError(
      "private message",
      "ERR_BAD_RESPONSE",
      config,
      undefined,
      {
        config,
        data: {},
        status: config.method === "post" ? 413 : 500,
        statusText: "error",
        headers: {},
      }
    );
  };
  const form = new FormData();
  form.set("file", new Blob(["private document"]), "private-name.docx");
  await expect(
    axiosBase.post("templates/12/import-word/preview", form)
  ).rejects.toBeInstanceOf(AxiosError);
  await expect(
    axiosBase.get("template-import/catalog", {
      params: { search: "private-search" },
    })
  ).rejects.toBeInstanceOf(AxiosError);
  await vi.waitFor(() => expect(events).toHaveLength(2));
  expect(events.map((event) => event.operation)).toEqual([
    "template.import",
    "template.import",
  ]);
  const text = JSON.stringify(events);
  expect(text).not.toContain("private-name");
  expect(text).not.toContain("private document");
  expect(text).not.toContain("private-search");
  expect(text).not.toContain("private message");
});

it.each([
  { method: "get" as const, path: "templates/12/workflow", status: 500 },
  { method: "post" as const, path: "templates/12/workflow", status: 422 },
  { method: "post" as const, path: "diagnostics/events", status: 500 },
  {
    method: "post" as const,
    path: "templates/12/content-control/clear",
    status: undefined,
  },
])(
  "$method $path не отправляет диагностику при нерелевантном сбое $status",
  async ({ method, path, status }) => {
    const events: DiagnosticEvent[] = [];
    setDiagnosticSender(async (event) => {
      events.push(event);
    });
    setFeedbackAvailable(true, getSessionGeneration());
    axiosBase.defaults.adapter = async (config) => {
      if (status === undefined) throw new CanceledError("cancelled", config);
      throw new AxiosError(
        "private message",
        "ERR_BAD_RESPONSE",
        config,
        undefined,
        {
          config,
          data: {},
          status,
          statusText: String(status),
          headers: {},
        }
      );
    };

    await expect(
      axiosBase.request({ method, url: path })
    ).rejects.toBeInstanceOf(AxiosError);
    expect(events).toHaveLength(0);
  }
);
