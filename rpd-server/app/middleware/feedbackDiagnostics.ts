import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { FeedbackService } from "../services/Feedback.ts";
import { pathOnly, uuidPattern } from "../modules/feedbackValidation.ts";

const service = new FeedbackService();
let inFlight = 0;
let windowStart = Date.now();
let windowCount = 0;

export function feedbackDiagnostics(serverRelease: string): RequestHandler {
  return (req, res, next) => {
    const given = req.get("X-Request-ID");
    const requestId = given && uuidPattern.test(given) ? given.toLowerCase() : randomUUID();
    res.setHeader("X-Request-ID", requestId);
    res.once("finish", () => {
      if (process.env.FEEDBACK_ENABLED !== "true") return;
      const status = res.statusCode;
      if (status !== 413 && status < 500) return;
      const route = pathOnly(req.originalUrl);
      if (!route || /^\/api\/(?:feedback|diagnostics)(?:\/|$)/.test(route)) return;
      const now = Date.now();
      if (now - windowStart >= 60_000) { windowStart = now; windowCount = 0; }
      if (windowCount >= 60 || inFlight >= 2) return;
      windowCount++;
      inFlight++;
      void service.serverFailure({
        operation: `http.${req.method.toLowerCase()}`,
        errorCode: `HTTP_${status}`,
        status,
        requestId,
        context: { clientRelease: serverRelease, route, breadcrumbs: [] },
      }, req.user ?? null).catch(() => {
        // Диагностика не влияет на исходный HTTP-ответ и не пишет тело/ошибку в лог.
        try { process.stderr.write("Не удалось сохранить диагностическое событие\n"); } catch { /* ответ уже завершён */ }
      }).finally(() => { inFlight--; });
    });
    next();
  };
}
