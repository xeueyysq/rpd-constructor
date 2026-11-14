import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import {
  addBreadcrumb,
  freezeDiagnosticContext,
  markHandledError,
  pathOnly,
  safeUuid,
  type FrozenDiagnostics,
} from "@shared/diagnostics";
import {
  captureHttpFailure,
  isDiagnosticPath,
} from "@shared/diagnostics/runtime";

export type DiagnosticRequest = InternalAxiosRequestConfig & {
  _diagnosticStart?: number;
  _diagnosticSnapshot?: FrozenDiagnostics;
  _diagnosticRequestId?: string;
  _diagnosticFinished?: boolean;
};

function requestPath(config: DiagnosticRequest): string | undefined {
  const url = config.url;
  if (typeof url !== "string") return undefined;
  try {
    return pathOnly(new URL(url, "http://rpd.local/api/").pathname);
  } catch {
    return undefined;
  }
}

function operationFor(
  path: string | undefined,
  method: string
): string | undefined {
  if (!path || isDiagnosticPath(path)) return undefined;
  if (method === "post") {
    if (/^\/api\/templates\/\d+\/import-word\/(?:preview|apply)$/.test(path))
      return "template.import";
    if (/^\/api\/templates\/\d+\/workflow$/.test(path))
      return "template.workflow";
    if (/^\/api\/templates\/\d+\/content-control\/clear$/.test(path))
      return "template.save";
  }
  if (
    /^\/api\/update-json-value\//.test(path) ||
    /^\/api\/(?:upset-template-comment|delete-template-comment)/.test(path)
  )
    return "template.save";
  if (path === "/api/create_rpd_complect") return "complect.create";
  if (
    path === "/api/complects/sync/apply" ||
    path === "/api/complects/sync/preview"
  )
    return "complect.sync";
  if (
    /^\/api\/(?:copy-template-data|copy-template-content|template-import\/(?:complect|sources|catalog)|get-changeable-values)/.test(
      path
    )
  )
    return "template.import";
  if (
    /^\/api\/complects\/\d+\/owners$/.test(path) ||
    /^\/api\/templates\/\d+\/participants$/.test(path)
  )
    return "participants.assign";
  if (
    /^\/api\/generate-(?:pdf|docx|assessment-funds-(?:docx|xlsx))$/.test(path)
  )
    return "document.generate";
  if (path === "/api/set-results-data") return "data.save";
  if (path === "/api/delete_rpd_complect") return "complect.delete";
  if (["put", "patch"].includes(method) && /^\/api\//.test(path))
    return "data.save";
  return undefined;
}

export function startDiagnosticRequest(config: DiagnosticRequest): void {
  if (typeof FormData !== "undefined" && config.data instanceof FormData)
    config.headers.setContentType(false);
  config._diagnosticRequestId =
    safeUuid(config.headers.get("X-Request-ID")) ??
    config._diagnosticRequestId ??
    crypto.randomUUID();
  config.headers.set("X-Request-ID", config._diagnosticRequestId);
  const path = requestPath(config);
  if (!path || isDiagnosticPath(path)) return;
  if (!config._diagnosticSnapshot) {
    const operation = operationFor(
      path,
      (config.method ?? "get").toLowerCase()
    );
    if (operation)
      addBreadcrumb({
        at: new Date().toISOString(),
        kind: "action",
        operation,
        route: path.replace(/\b\d+\b/g, ":id"),
      });
    config._diagnosticSnapshot = freezeDiagnosticContext();
    config._diagnosticStart = performance.now();
  }
}

export function finishDiagnosticRequest(
  config: DiagnosticRequest | undefined,
  response?: AxiosResponse,
  error?: AxiosError
): void {
  if (
    !config ||
    config._diagnosticFinished ||
    !config._diagnosticSnapshot ||
    config._diagnosticStart === undefined
  )
    return;
  const snapshot = config._diagnosticSnapshot;
  const path = requestPath(config);
  if (!path || isDiagnosticPath(path)) return;
  const status = response?.status ?? error?.response?.status;
  if (status === 401) return; // refresh может повторить тот же запрос.
  config._diagnosticFinished = true;
  const operation = operationFor(path, (config.method ?? "get").toLowerCase());
  const requestId =
    safeUuid(
      response?.headers?.["x-request-id"] ??
        error?.response?.headers?.["x-request-id"]
    ) ?? config._diagnosticRequestId;
  const durationMs = Math.min(
    3_600_000,
    Math.max(0, Math.round(performance.now() - config._diagnosticStart))
  );
  addBreadcrumb(
    {
      at: new Date().toISOString(),
      kind: "http",
      operation,
      method: config.method?.toUpperCase(),
      route: path.replace(/\b\d+\b/g, ":id"),
      status,
      durationMs,
      requestId,
    },
    snapshot.generation
  );
  if (!error || !operation || axios.isCancel(error)) return;
  if (
    status !== 413 &&
    (status === undefined
      ? !["ERR_NETWORK", "ETIMEDOUT", "ECONNABORTED"].includes(error.code ?? "")
      : status < 500)
  )
    return;
  captureHttpFailure({
    frozen: {
      ...snapshot,
      context: {
        ...snapshot.context,
        breadcrumbs: [
          ...(snapshot.context.breadcrumbs ?? []),
          {
            at: new Date().toISOString(),
            kind: "http",
            operation,
            method: config.method?.toUpperCase(),
            route: path.replace(/\b\d+\b/g, ":id"),
            status,
            durationMs,
            requestId,
          },
        ],
      },
    },
    operation,
    status,
    requestId,
    errorCode:
      status === 413
        ? "payload_too_large"
        : status
          ? "http_error"
          : (error.code ?? "network_error"),
    stack: error.stack,
  });
}

export function markAxiosErrorHandled(error: unknown): void {
  if (axios.isAxiosError(error)) markHandledError(error);
}
