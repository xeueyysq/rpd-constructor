import { randomUUID } from "node:crypto";
import type { RequestHandler, Response } from "express";
import { FeedbackService } from "../services/Feedback.ts";
import { pathOnly, uuidPattern } from "../modules/feedbackValidation.ts";
import { classifyFeedbackFailure, type SafeFeedbackFailure } from "../modules/feedbackStack.ts";

const service = new FeedbackService();
let inFlight = 0;
let windowStart = Date.now();
let windowCount = 0;

export function markFeedbackFailure(res: Response, error: unknown): void {
  const failure = classifyFeedbackFailure(error);
  if (failure) res.locals.feedbackFailure = failure;
}

export function feedbackDiagnostics(serverRelease: string): RequestHandler {
  return (req, res, next) => {
    const started = Date.now();
    const given = req.get("X-Request-ID");
    const requestId = given && uuidPattern.test(given) ? given.toLowerCase() : randomUUID();
    res.setHeader("X-Request-ID", requestId);
    res.once("finish", () => {
      if (process.env.FEEDBACK_ENABLED !== "true") return;
      const status = res.statusCode;
      if (status !== 413 && status < 500) return;
      const route = pathOnly(req.originalUrl);
      if (!route || /^\/api\/(?:feedback|diagnostics|health)(?:\/|$)/.test(route)
        || /^\/api\/templates\/[^/]+\/presence$/.test(route)) return;
      const now = Date.now();
      if (now - windowStart >= 60_000) { windowStart = now; windowCount = 0; }
      if (windowCount >= 60 || inFlight >= 2) return;
      windowCount++;
      inFlight++;
      const failure = res.locals.feedbackFailure as SafeFeedbackFailure | undefined;
      const bytes = Number(req.get("Content-Length"));
      void service.serverFailure({
        operation: `http.${req.method.toLowerCase()}`,
        errorCode: failure?.errorCode ?? `HTTP_${status}`,
        status,
        requestId,
        stack: failure?.stack,
        context: { clientRelease: serverRelease, route, breadcrumbs: [{ at: new Date().toISOString(),
          kind: "http", method: req.method, route, status, requestId,
          durationMs: Math.min(Date.now() - started, 3_600_000),
          ...(Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= 3_145_728 ? { requestBytes: bytes } : {}) }] },
      }, req.user ?? null).catch(() => {
        // Диагностика не влияет на исходный HTTP-ответ и не пишет тело/ошибку в лог.
        try { process.stderr.write("Не удалось сохранить диагностическое событие\n"); } catch { /* ответ уже завершён */ }
      }).finally(() => { inFlight--; });
    });
    next();
  };
}
