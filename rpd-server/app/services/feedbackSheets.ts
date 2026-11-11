import axios from "axios";
import { statSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import type { OutboxPayload } from "./Feedback.ts";

export const SHEET_HEADER = ["Код", "Дата", "Тип", "Кратко", "Приоритет", "Статус",
  "Комплект / дисциплина", "Версия", "Повторы", "Последний случай", "Диагностика"] as const;
const SPREADSHEET_DEFAULT = "1T9z4JW_Lf27eXX1ONo4sqC8e_N5-0kS1b8Q6cn7pF7w";
const MAX_SHEET_ROWS = 20_000;

export type SheetConfig = { enabled: boolean; ready: boolean; reason: string | null;
  spreadsheetId: string; sheetName: string; credentialsFile: string; publicBaseUrl: string };

function credentialFilePresent(path: string): boolean {
  try { return statSync(path).isFile(); } catch { return false; }
}

export function sheetConfig(): SheetConfig {
  const enabled = process.env.FEEDBACK_GOOGLE_ENABLED === "true";
  const spreadsheetId = process.env.FEEDBACK_GOOGLE_SPREADSHEET_ID || SPREADSHEET_DEFAULT;
  const sheetName = process.env.FEEDBACK_GOOGLE_SHEET_NAME || "Обращения";
  const credentialsFile = process.env.FEEDBACK_GOOGLE_CREDENTIALS_FILE || "";
  const publicBaseUrl = process.env.FEEDBACK_PUBLIC_BASE_URL || "";
  let reason: string | null = null;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(spreadsheetId)) reason = "SPREADSHEET_ID_INVALID";
  else if (!/^[\p{L}\p{N} _-]{1,60}$/u.test(sheetName) || /^(?:вход|статусыРПД)$/iu.test(sheetName)) reason = "SHEET_NAME_INVALID";
  else if (!credentialsFile || !credentialFilePresent(credentialsFile)) reason = "CREDENTIALS_FILE_MISSING";
  else {
    try {
      const url = new URL(publicBaseUrl);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
        reason = "PUBLIC_URL_INVALID";
    } catch { reason = "PUBLIC_URL_INVALID"; }
  }
  return { enabled, ready: enabled && reason === null, reason, spreadsheetId, sheetName, credentialsFile, publicBaseUrl };
}

type SafeContext = { clientRelease?: string; route?: string; complectId?: number; templateId?: number;
  discipline?: string; section?: string; faculty?: string; direction?: string; profile?: string; form?: string; year?: string };

function contextOf(value: unknown): SafeContext {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SafeContext : {};
}

function safeLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return Array.from(value, (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char).join("").trim().slice(0, 100);
}

function timestamp(value: Date): string {
  return value.toISOString();
}

export function sheetRow(payload: OutboxPayload, publicBaseUrl: string): string[] {
  const context = contextOf(payload.context);
  const section = safeLabel(context.section);
  const summary = payload.type === "manual" ? ["обращение пользователя", section].filter(Boolean).join(": ").toLocaleLowerCase("ru-RU")
    : ["ошибка", payload.operation.replace(/[._:-]+/g, " "), payload.errorCode.replace(/[._:-]+/g, " ")]
      .join(" · ").toLocaleLowerCase("ru-RU").replace(/[.\s]+$/g, "");
  const high = payload.type === "manual" ? payload.blocking
    : /(?:save|create|sync|import|participant|generate|document|pdf|docx|complect|template|assessment-funds)/i.test(`${payload.operation} ${context.route ?? ""}`)
      && (payload.status === undefined || payload.status === null || payload.status >= 500);
  const curricular = [context.complectId ? `№ ${context.complectId}` : "", safeLabel(context.discipline),
    safeLabel(context.faculty), safeLabel(context.direction), safeLabel(context.profile),
    safeLabel(context.form), safeLabel(context.year)].filter(Boolean).join(" / ").slice(0, 400);
  const link = new URL(`/feedback/${payload.id}`, publicBaseUrl).toString();
  return [payload.code, timestamp(payload.createdAt), payload.type === "manual" ? "Обращение" : "Ошибка",
    summary, high ? "Высокий" : "Средний", "Новое", curricular, safeLabel(context.clientRelease),
    payload.type === "manual" ? "1" : String(payload.count),
    timestamp(payload.type === "manual" ? payload.createdAt : payload.lastSeen), link];
}

export class DeliveryError extends Error {
  readonly code: string;
  readonly providerCooldown: boolean;
  constructor(code: string, providerCooldown = false) {
    super(code);
    this.code = code;
    this.providerCooldown = providerCooldown;
  }
}

export function findCodeRow(values: unknown, code: string): number | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_SHEET_ROWS + 1)
    throw new DeliveryError("SHEET_LOOKUP_INVALID", true);
  const matches: number[] = [];
  const seen = new Set<string>();
  values.forEach((row: unknown, index) => {
    if (index === 0 || !Array.isArray(row) || row.length === 0 || row[0] === "") return;
    if (typeof row[0] !== "string" || !/^RPD-\d+$/.test(row[0])) throw new DeliveryError("SHEET_CODE_COLUMN_INVALID", true);
    if (seen.has(row[0])) throw new DeliveryError("DUPLICATE_CODE", true);
    seen.add(row[0]);
    if (row[0] === code) matches.push(index + 1);
  });
  if (values.length === MAX_SHEET_ROWS + 1) throw new DeliveryError("SHEET_ROW_LIMIT", true);
  return matches[0] ?? null;
}

function valueRows(value: unknown): unknown {
  if (!value || typeof value !== "object" || !("values" in value)) throw new DeliveryError("SHEET_RESPONSE_INVALID", true);
  return value.values;
}

export class FeedbackSheets {
  private readonly auth: GoogleAuth;
  private readonly base: string;
  private readonly tab: string;
  private readonly config: SheetConfig;

  constructor(config: SheetConfig) {
    this.config = config;
    this.auth = new GoogleAuth({ keyFilename: config.credentialsFile,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      clientOptions: { transporterOptions: { timeout: 3500, retry: false } } });
    this.base = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`;
    this.tab = `'${config.sheetName}'!`;
  }

  private async request(method: "GET" | "POST" | "PUT", range: string, data?: unknown): Promise<unknown> {
    let token: string | null | undefined;
    try {
      token = await Promise.race([this.auth.getAccessToken(), new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new DeliveryError("AUTH_TIMEOUT", true)), 4000))]);
      if (!token) throw new DeliveryError("AUTH_UNAVAILABLE", true);
    } catch (error) {
      if (error instanceof DeliveryError) throw error;
      throw new DeliveryError("AUTH_UNAVAILABLE", true);
    }
    try {
      const response = await axios.request<unknown>({
        method, url: `${this.base}/values/${encodeURIComponent(this.tab + range.replace(/:append$/, ""))}${range.endsWith(":append") ? ":append" : ""}`,
        params: method === "GET" ? { valueRenderOption: "UNFORMATTED_VALUE" } : { valueInputOption: "RAW", ...(range.endsWith(":append") ? { insertDataOption: "INSERT_ROWS" } : {}) },
        headers: { Authorization: `Bearer ${token}` }, data, timeout: 3500, maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024, maxBodyLength: 16 * 1024,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) throw new DeliveryError("PROVIDER_RATE_LIMIT", true);
        if (status === 401 || status === 403) throw new DeliveryError("PROVIDER_AUTH", true);
        if (status === 400 || status === 404) throw new DeliveryError("PROVIDER_CONFIG", true);
        if (status && status >= 500) throw new DeliveryError("PROVIDER_5XX", true);
        throw new DeliveryError("PROVIDER_NETWORK", true);
      }
      throw new DeliveryError("PROVIDER_NETWORK", true);
    }
  }

  async sync(payload: OutboxPayload): Promise<void> {
    const header = valueRows(await this.request("GET", "A1:K1"));
    if (!Array.isArray(header) || !Array.isArray(header[0]) || !SHEET_HEADER.every((value, i) => header[0][i] === value)
      || header[0].length !== SHEET_HEADER.length) throw new DeliveryError("SHEET_HEADER_MISMATCH", true);
    const codes = valueRows(await this.request("GET", `A1:A${MAX_SHEET_ROWS + 1}`));
    const row = findCodeRow(codes, payload.code);
    const values = sheetRow(payload, this.config.publicBaseUrl);
    if (row === null) {
      await this.request("POST", "A1:K:append", { values: [values] });
      return;
    }
    // При повторе меняются только счётчик и время. Остальные правки редакторов сохраняются.
    await this.request("PUT", `I${row}:J${row}`, { values: [values.slice(8, 10)] });
  }
}
