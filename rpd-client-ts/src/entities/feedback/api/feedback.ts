import {
  axiosBase,
  getSessionGeneration,
  SessionChangedError,
} from "@shared/api";
import {
  boundedContext,
  freezeDiagnosticContext,
  getFeedbackAvailable,
  subscribeFeedbackAvailability,
  type DiagnosticContext,
  type DiagnosticEvent,
  type FrozenDiagnostics,
} from "@shared/diagnostics";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export type FeedbackReceipt = { id: string; code: string; warning?: string };
export type ManualFeedbackDraft = {
  clientReportId: string;
  frozen: FrozenDiagnostics;
};
export type ManualFeedbackInput = ManualFeedbackDraft & {
  goal: string;
  actual: string;
  blocking: boolean;
  screenshot?: File;
};
export type FeedbackDetail = {
  id: string;
  code: string;
  type: "manual" | "diagnostic";
  createdAt: string;
  actorId: number | null;
  context: DiagnosticContext;
  requestId: string | null;
  goal?: string;
  actual?: string;
  blocking?: boolean;
  warning?: string | null;
  screenshotMime?: string | null;
  screenshotSize?: number;
  operation?: string;
  errorCode?: string;
  status?: number | null;
  stack?: string | null;
  count?: number;
  lastSeen?: string;
  lastContext?: DiagnosticContext;
};
export type FeedbackDeliveryStatus = {
  pending: number;
  leased: number;
  oldestPending: string | null;
  lastError: string | null;
  cooldownUntil: string | null;
  deliveryEnabled: boolean;
  deliveryReady: boolean;
  configError: string | null;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Некорректный ответ сервера");
  return value as Record<string, unknown>;
}
function receipt(value: unknown): FeedbackReceipt {
  const row = object(value);
  if (
    typeof row.id !== "string" ||
    !uuid.test(row.id) ||
    typeof row.code !== "string" ||
    !/^RPD-\d+$/.test(row.code) ||
    (row.warning !== undefined && typeof row.warning !== "string")
  )
    throw new Error("Некорректная квитанция сервера");
  return {
    id: row.id,
    code: row.code,
    ...(typeof row.warning === "string" ? { warning: row.warning } : {}),
  };
}

export function createManualFeedbackDraft(): ManualFeedbackDraft {
  return {
    clientReportId: crypto.randomUUID(),
    frozen: freezeDiagnosticContext(),
  };
}

export async function getFeedbackConfig(): Promise<{ enabled: boolean }> {
  const generation = getSessionGeneration();
  const { data } = await axiosBase.get<unknown>("feedback/config");
  if (generation !== getSessionGeneration()) throw new SessionChangedError();
  const row = object(data);
  if (typeof row.enabled !== "boolean")
    throw new Error("Некорректная конфигурация обращений");
  return { enabled: row.enabled };
}

export function useFeedbackConfig(enabled: boolean) {
  return useQuery({
    queryKey: ["feedback-config"],
    queryFn: getFeedbackConfig,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useFeedbackAvailability(): boolean {
  return useSyncExternalStore(
    subscribeFeedbackAvailability,
    getFeedbackAvailable
  );
}

export async function submitManualFeedback(
  input: ManualFeedbackInput
): Promise<FeedbackReceipt> {
  if (input.frozen.generation !== getSessionGeneration())
    throw new SessionChangedError();
  if (
    !uuid.test(input.clientReportId) ||
    !input.goal.trim() ||
    input.goal.length > 4000 ||
    !input.actual.trim() ||
    input.actual.length > 8000 ||
    typeof input.blocking !== "boolean"
  )
    throw new Error("Проверьте описание обращения");
  if (
    input.screenshot &&
    (input.screenshot.size > MAX_SCREENSHOT_BYTES ||
      !["image/png", "image/jpeg"].includes(input.screenshot.type))
  )
    throw new Error("Нужен PNG или JPEG размером до 2 МиБ");
  const form = new FormData();
  form.append(
    "payload",
    JSON.stringify({
      clientReportId: input.clientReportId,
      goal: input.goal,
      actual: input.actual,
      blocking: input.blocking,
      context: boundedContext(input.frozen.context),
    })
  );
  if (new TextEncoder().encode(String(form.get("payload"))).length > 32 * 1024)
    throw new Error("Описание и диагностические данные слишком велики");
  if (input.screenshot) form.append("screenshot", input.screenshot);
  const { data } = await axiosBase.post<unknown>("feedback", form, {
    headers: { "Content-Type": undefined },
  });
  if (input.frozen.generation !== getSessionGeneration())
    throw new SessionChangedError();
  return receipt(data);
}

export function useSubmitFeedback() {
  return useMutation({ mutationFn: submitManualFeedback, retry: false });
}

export async function sendDiagnosticEvent(
  event: DiagnosticEvent
): Promise<void> {
  const generation = getSessionGeneration();
  const { data } = await axiosBase.post<unknown>("diagnostics/events", event);
  if (generation !== getSessionGeneration()) throw new SessionChangedError();
  const row = object(data);
  receipt(row);
  if (
    typeof row.count !== "number" ||
    !Number.isSafeInteger(row.count) ||
    row.count < 1
  )
    throw new Error("Некорректная квитанция диагностики");
}

export async function getFeedbackDetail(id: string): Promise<FeedbackDetail> {
  if (!uuid.test(id)) throw new Error("Некорректный ID обращения");
  const { data } = await axiosBase.get<unknown>(`feedback/${id}`);
  const row = object(data);
  if (
    typeof row.id !== "string" ||
    !uuid.test(row.id) ||
    typeof row.code !== "string" ||
    !/^RPD-\d+$/.test(row.code)
  )
    throw new Error("Некорректные данные обращения");
  if (
    (row.type !== "manual" && row.type !== "diagnostic") ||
    typeof row.createdAt !== "string" ||
    !row.context ||
    typeof row.context !== "object" ||
    (row.actorId !== null &&
      (typeof row.actorId !== "number" ||
        !Number.isSafeInteger(row.actorId))) ||
    (row.requestId !== null &&
      (typeof row.requestId !== "string" || !uuid.test(row.requestId)))
  )
    throw new Error("Некорректные данные обращения");
  const detail: FeedbackDetail = {
    id: row.id,
    code: row.code,
    type: row.type,
    createdAt: row.createdAt,
    actorId: row.actorId,
    requestId: row.requestId,
    context: boundedContext(row.context as DiagnosticContext),
  };
  if (row.type === "manual") {
    if (
      typeof row.goal !== "string" ||
      typeof row.actual !== "string" ||
      typeof row.blocking !== "boolean"
    )
      throw new Error("Некорректные данные обращения");
    detail.goal = row.goal;
    detail.actual = row.actual;
    detail.blocking = row.blocking;
    if (typeof row.warning === "string" || row.warning === null)
      detail.warning = row.warning;
    if (typeof row.screenshotMime === "string" || row.screenshotMime === null)
      detail.screenshotMime = row.screenshotMime;
    if (
      typeof row.screenshotSize === "number" &&
      Number.isSafeInteger(row.screenshotSize)
    )
      detail.screenshotSize = row.screenshotSize;
  } else {
    if (
      typeof row.operation !== "string" ||
      typeof row.errorCode !== "string" ||
      typeof row.count !== "number" ||
      !Number.isSafeInteger(row.count)
    )
      throw new Error("Некорректные данные диагностики");
    detail.operation = row.operation;
    detail.errorCode = row.errorCode;
    detail.count = row.count;
    if (typeof row.status === "number" || row.status === null)
      detail.status = row.status;
    if (typeof row.stack === "string" || row.stack === null)
      detail.stack = row.stack;
    if (typeof row.lastSeen === "string") detail.lastSeen = row.lastSeen;
    if (
      row.lastContext &&
      typeof row.lastContext === "object" &&
      !Array.isArray(row.lastContext)
    )
      detail.lastContext = boundedContext(row.lastContext as DiagnosticContext);
  }
  return detail;
}

export function useFeedbackDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["feedback-detail", id],
    queryFn: () => getFeedbackDetail(id!),
    enabled: Boolean(id),
    retry: false,
  });
}

export async function getFeedbackScreenshot(id: string): Promise<Blob> {
  if (!uuid.test(id)) throw new Error("Некорректный ID обращения");
  const { data } = await axiosBase.get<Blob>(`feedback/${id}/screenshot`, {
    responseType: "blob",
  });
  if (
    !(data instanceof Blob) ||
    !["image/png", "image/jpeg"].includes(data.type)
  )
    throw new Error("Некорректный скриншот");
  return data;
}

export function useFeedbackScreenshot(
  id: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["feedback-screenshot", id],
    queryFn: () => getFeedbackScreenshot(id!),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export async function getFeedbackDeliveryStatus(): Promise<FeedbackDeliveryStatus> {
  const { data } = await axiosBase.get<unknown>("feedback/delivery-status");
  const row = object(data);
  if (
    typeof row.pending !== "number" ||
    typeof row.leased !== "number" ||
    typeof row.deliveryEnabled !== "boolean" ||
    typeof row.deliveryReady !== "boolean" ||
    (row.oldestPending !== null && typeof row.oldestPending !== "string") ||
    (row.lastError !== null && typeof row.lastError !== "string") ||
    (row.cooldownUntil !== null && typeof row.cooldownUntil !== "string") ||
    (row.configError !== null && typeof row.configError !== "string")
  )
    throw new Error("Некорректное состояние доставки");
  return {
    pending: row.pending,
    leased: row.leased,
    oldestPending: row.oldestPending,
    lastError: row.lastError,
    cooldownUntil: row.cooldownUntil,
    deliveryEnabled: row.deliveryEnabled,
    deliveryReady: row.deliveryReady,
    configError: row.configError,
  };
}

export function useFeedbackDeliveryStatus(enabled = true) {
  return useQuery({
    queryKey: ["feedback-delivery-status"],
    queryFn: getFeedbackDeliveryStatus,
    enabled,
    retry: false,
  });
}
