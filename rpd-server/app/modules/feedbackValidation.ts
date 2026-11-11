import { createHash } from "node:crypto";
import { Unprocessable } from "../utils/Errors.ts";

export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
export const MAX_METADATA_BYTES = 32 * 1024;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Plain = Record<string, unknown>;
type Context = {
  clientRelease?: string; route?: string; primaryRole?: string; activeRole?: string;
  complectId?: number; templateId?: number; section?: string;
  faculty?: string; direction?: string; profile?: string; form?: string; year?: string;
  browser?: string;
  breadcrumbs?: Array<{ at: string; kind: string; operation?: string; method?: string; route?: string; status?: number; durationMs?: number; requestId?: string; requestBytes?: number }>;
};

function plain(value: unknown): Plain {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Unprocessable("Некорректные данные обращения");
  return value as Plain;
}

function requiredText(value: unknown, limit: number, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Unprocessable(`Некорректное поле ${name}`);
  return value;
}

function optionalText(value: unknown, limit: number): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, limit) : undefined;
}

function uuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Unprocessable(`Некорректное поле ${name}`);
  return value.toLowerCase();
}

function boundedInteger(value: unknown, max: number): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max ? value : undefined;
}

export function pathOnly(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  const path = value.split(/[?#]/, 1)[0];
  return path.length <= 300 && !Array.from(path).some((char) => char === "\\" || char.charCodeAt(0) < 32) ? path : undefined;
}

function stableOperation(value: unknown, name: string): string {
  const text = requiredText(value, 80, name);
  if (!/^[a-z][a-z0-9._:-]*$/i.test(text)) throw new Unprocessable(`Некорректное поле ${name}`);
  return text;
}

export function cleanStack(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const frames = value.split("\n").slice(1, 9).map((line) => {
    const match = line.match(/^\s*at\s+([\w.$<>-]{1,100})(?:\s|$)/);
    if (!match) return undefined;
    return match[1];
  }).filter((line): line is string => Boolean(line));
  return frames.length ? frames.join("\n").slice(0, 1200) : undefined;
}

export function sanitizeContext(value: unknown): Context {
  const source = plain(value);
  const context: Context = {};
  const labels = ["clientRelease", "primaryRole", "activeRole", "section", "faculty", "direction", "profile", "form", "year", "browser"] as const;
  for (const key of labels) {
    const text = optionalText(source[key], key === "browser" ? 120 : 160);
    if (text) context[key] = Array.from(text, (char) => char.charCodeAt(0) < 32 ? " " : char).join("");
  }
  context.route = pathOnly(source.route);
  context.complectId = boundedInteger(source.complectId, 2_147_483_647);
  context.templateId = boundedInteger(source.templateId, 2_147_483_647);
  if (Array.isArray(source.breadcrumbs)) {
    context.breadcrumbs = source.breadcrumbs.slice(-30).flatMap((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const row = item as Plain;
      const at = typeof row.at === "string" && !Number.isNaN(Date.parse(row.at)) ? new Date(row.at).toISOString() : undefined;
      const kind = typeof row.kind === "string" && /^(?:http|navigation|action|error)$/.test(row.kind) ? row.kind : undefined;
      if (!at || !kind) return [];
      const breadcrumb: NonNullable<Context["breadcrumbs"]>[number] = { at, kind };
      if (typeof row.operation === "string" && /^[a-z][a-z0-9._:-]{0,79}$/i.test(row.operation)) breadcrumb.operation = row.operation;
      if (typeof row.method === "string" && /^(GET|POST|PUT|PATCH|DELETE)$/.test(row.method)) breadcrumb.method = row.method;
      breadcrumb.route = pathOnly(row.route);
      breadcrumb.status = boundedInteger(row.status, 599);
      breadcrumb.durationMs = boundedInteger(row.durationMs, 3_600_000);
      breadcrumb.requestBytes = boundedInteger(row.requestBytes, 3_145_728);
      if (typeof row.requestId === "string" && uuidPattern.test(row.requestId)) breadcrumb.requestId = row.requestId.toLowerCase();
      return [breadcrumb];
    });
  }
  if (Buffer.byteLength(JSON.stringify(context)) > MAX_METADATA_BYTES) throw new Unprocessable("Диагностические данные слишком велики");
  return context;
}

export type ManualInput = { clientReportId: string; goal: string; actual: string; blocking: boolean; context: Context; requestId?: string };
export function parseManual(value: unknown): ManualInput {
  const row = plain(value);
  const context = sanitizeContext(row.context);
  if (typeof row.blocking !== "boolean") throw new Unprocessable("Некорректное поле blocking");
  return {
    clientReportId: uuid(row.clientReportId, "clientReportId"),
    goal: requiredText(row.goal, 4000, "goal"),
    actual: requiredText(row.actual, 8000, "actual"),
    blocking: row.blocking,
    context,
    requestId: context.breadcrumbs?.findLast((entry) => entry.requestId)?.requestId,
  };
}

export type DiagnosticInput = { clientEventId: string; operation: string; errorCode: string; status?: number; requestId?: string; stack?: string; context: Context };
export function parseDiagnostic(value: unknown): DiagnosticInput {
  const row = plain(value);
  const status = row.status === undefined ? undefined : boundedInteger(row.status, 599);
  if (row.status !== undefined && (status === undefined || status < 100)) throw new Unprocessable("Некорректный статус");
  if (status !== undefined && status !== 413 && status < 500) throw new Unprocessable("Ожидаемые ошибки не регистрируются");
  const context = sanitizeContext(row.context);
  const operation = stableOperation(row.operation, "operation");
  const errorCode = stableOperation(row.errorCode, "errorCode");
  if (/^(?:sessionchangederror|session_changed|cancelled|canceled|aborterror)$/i.test(errorCode)
    || /^\/(?:api\/)?(?:feedback|diagnostics)(?:\/|$)/.test(context.route ?? "")) {
    throw new Unprocessable("Ожидаемые действия не регистрируются");
  }
  if (typeof row.requestId === "string" && !uuidPattern.test(row.requestId)) throw new Unprocessable("Некорректный requestId");
  const result = {
    clientEventId: uuid(row.clientEventId, "clientEventId"),
    operation,
    errorCode,
    status,
    requestId: typeof row.requestId === "string" ? row.requestId.toLowerCase() : undefined,
    stack: cleanStack(row.stack),
    context,
  };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_METADATA_BYTES) throw new Unprocessable("Диагностические данные слишком велики");
  return result;
}

export function diagnosticFingerprint(event: Omit<DiagnosticInput, "clientEventId">): string {
  const route = event.context.route?.replace(/\b\d+\b/g, ":id").replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
  return createHash("sha256").update(JSON.stringify([
    event.context.clientRelease ?? "", event.operation, route ?? "", event.status ?? null,
    event.errorCode, event.stack?.split("\n", 1)[0] ?? "",
  ])).digest("hex");
}

export function screenshotMime(data: Buffer): "image/png" | "image/jpeg" | undefined {
  if (data.length >= 45 && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    && data.readUInt32BE(8) === 13 && data.subarray(12, 16).toString("ascii") === "IHDR"
    && data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0
    && data.subarray(-12, -8).equals(Buffer.from([0,0,0,0]))
    && data.subarray(-8, -4).toString("ascii") === "IEND") return "image/png";
  if (data.length >= 20 && data[0] === 255 && data[1] === 216 && data[2] === 255
    && data.at(-2) === 255 && data.at(-1) === 217) return "image/jpeg";
  return undefined;
}
