import express, { type RequestHandler } from "express";
import fileUpload from "express-fileupload";
import { pool } from "../../config/db.ts";
import TokenService from "../services/Token.ts";
import { FeedbackService } from "../services/Feedback.ts";
import { USER_ROLES } from "../models/constants.ts";
import { Forbidden, Unprocessable } from "../utils/Errors.ts";
import { MAX_SCREENSHOT_BYTES, parseDiagnostic, parseManual, screenshotMime, uuidPattern } from "../modules/feedbackValidation.ts";

const router = express.Router();
const feedback = new FeedbackService();
const MAX_MULTIPART_BYTES = 3 * 1024 * 1024;
const buckets = new Map<number, { until: number; manual: number; automatic: number; active: number }>();
let activeUploads = 0;

const enabled: RequestHandler = (_req, res, next) => {
  if (process.env.FEEDBACK_ENABLED !== "true") { res.status(503).json({ error: "Обращения временно недоступны" }); return; }
  next();
};

const active: RequestHandler = async (req, _res, next) => {
  const actor = req.user;
  if (!actor) throw new Forbidden();
  const { rows } = await pool.query<{ role: number; is_active: boolean }>("SELECT role,is_active FROM users WHERE id=$1", [actor.id]);
  if (!rows[0]?.is_active || rows[0].role !== actor.role) throw new Forbidden("Пользователь неактивен или роль изменилась");
  next();
};

function limit(perMinute: number, upload: boolean): RequestHandler {
  return (req, res, next) => {
    const id = req.user!.id;
    const now = Date.now();
    let state = buckets.get(id);
    if (!state || state.until <= now) {
      if (buckets.size >= 1024) {
        for (const [key, value] of buckets) if (value.until <= now && value.active === 0) buckets.delete(key);
      }
      if (buckets.size >= 1024) { res.status(429).json({ error: "Слишком много обращений" }); return; }
      state = { until: now + 60_000, manual: 0, automatic: 0, active: 0 };
      buckets.set(id, state);
    }
    const category = upload ? "manual" : "automatic";
    if (state[category] >= perMinute || upload && (state.active >= 1 || activeUploads >= 2)) {
      res.status(429).json({ error: "Слишком много обращений" }); return;
    }
    state[category]++;
    if (upload) {
      state.active++;
      activeUploads++;
      res.once("finish", () => { state.active--; activeUploads--; });
      res.once("close", () => { if (!res.writableFinished) { state.active--; activeUploads--; } });
    }
    next();
  };
}

const upload = fileUpload({
  abortOnLimit: true,
  limits: { fileSize: MAX_SCREENSHOT_BYTES, fieldSize: 32 * 1024, fields: 1, files: 1, parts: 2 },
  useTempFiles: false,
  parseNested: false,
});

router.post("/feedback", enabled, TokenService.checkAccess, active, limit(10, true), (req, res, next) => {
  const contentLength = Number(req.headers["content-length"]);
  if (!req.is("multipart/form-data") || !Number.isFinite(contentLength) || contentLength <= 0) {
    res.status(415).json({ error: "Ожидается multipart/form-data" }); return;
  }
  if (contentLength > MAX_MULTIPART_BYTES) { res.status(413).json({ error: "Обращение слишком велико" }); return; }
  next();
}, upload, async (req, res) => {
  if (Object.keys(req.body ?? {}).some((key) => key !== "payload")
    || Object.keys(req.files ?? {}).some((key) => key !== "screenshot")) throw new Unprocessable("Неизвестное поле обращения");
  if (typeof req.body?.payload !== "string" || Buffer.byteLength(req.body.payload) > 32 * 1024) throw new Unprocessable("Некорректные данные обращения");
  let parsed: unknown;
  try { parsed = JSON.parse(req.body.payload); } catch { throw new Unprocessable("Некорректный JSON обращения"); }
  const input = parseManual(parsed);
  const file = req.files?.screenshot;
  if (Array.isArray(file)) throw new Unprocessable("Допускается один скриншот");
  let screenshot: { data: Buffer; mime: "image/png" | "image/jpeg" } | undefined;
  if (file) {
    if (file.truncated || file.size > MAX_SCREENSHOT_BYTES || !Buffer.isBuffer(file.data)) throw new Unprocessable("Скриншот слишком велик");
    const mime = screenshotMime(file.data);
    if (!mime || file.mimetype !== mime) throw new Unprocessable("Допускаются PNG и JPEG");
    screenshot = { data: file.data, mime };
  }
  res.status(201).json(await feedback.manual(req.user!, input, screenshot));
});

router.post("/diagnostics/events", enabled, TokenService.checkAccess, active, limit(30, false), express.json({ limit: "40kb" }), async (req, res) => {
  const input = parseDiagnostic(req.body);
  res.status(201).json(await feedback.diagnostic(req.user!, input));
});

const admin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== USER_ROLES.ADMIN) throw new Forbidden("Действие доступно только администратору");
  next();
};

router.get("/feedback/config", TokenService.checkAccess, active, (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ enabled: process.env.FEEDBACK_ENABLED === "true" });
});
router.get("/feedback/delivery-status", enabled, TokenService.checkAccess, active, admin, async (req, res) => {
  res.json(await feedback.deliveryStatus(req.user!));
});
router.get("/feedback/:id/screenshot", enabled, TokenService.checkAccess, active, admin, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string" || !uuidPattern.test(id)) throw new Unprocessable("Некорректный ID обращения");
  const image = await feedback.screenshot(req.user!, id);
  res.set("Content-Type", image.mime);
  res.set("Content-Disposition", "inline");
  res.set("Cache-Control", "no-store");
  res.send(image.data);
});
router.get("/feedback/:id", enabled, TokenService.checkAccess, active, admin, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string" || !uuidPattern.test(id)) throw new Unprocessable("Некорректный ID обращения");
  res.set("Cache-Control", "no-store");
  res.json(await feedback.detail(req.user!, id));
});

export default router;
