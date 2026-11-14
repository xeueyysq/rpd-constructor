import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import fileUpload from "express-fileupload";
import TemplateAccess from "../services/TemplateAccess.ts";
import TemplateImport from "../services/TemplateImport.ts";
import { inspectDocx, MAX_DOCX_BYTES } from "../modules/wordImport/inspectDocx.ts";
import { parseWord } from "../modules/wordImport/parseWord.ts";
import { PayloadTooLarge, TooManyRequests, Unprocessable } from "../utils/Errors.ts";

const MAX_MULTIPART_BYTES = 6 * 1024 * 1024;
const MAX_APPLY_BYTES = 90 * 1024;
const WINDOW_MS = 60_000;
const LIMIT_PER_ACTOR = 6;
let parsingReserved = false;
const requests = new Map<number, { started: number; count: number }>();
type PreviewLifecycle = { signal: AbortSignal; start: () => void; release: () => void };

const upload = fileUpload({ abortOnLimit: true, responseOnLimit: "DOCX больше 5 МБ",
  limits: { fileSize: MAX_DOCX_BYTES, files: 1, fields: 0, parts: 1 },
  useTempFiles: false, parseNested: false, uploadTimeout: 10_000 });

export default class WordImportController {
  private readonly imports: TemplateImport;
  constructor(pool: Pool) { this.imports = new TemplateImport(pool); }

  authorizePreview = async (req: Request, res: Response, next: NextFunction) => {
    const actor = TemplateAccess.actor(req.user);
    const snapshot = await this.imports.wordSnapshot(actor, req.params.id);
    if (!req.is("multipart/form-data")) throw new Unprocessable("Ожидается multipart/form-data с полем file");
    const length = Number(req.headers["content-length"]);
    if (!Number.isFinite(length) || length <= 0) throw new Unprocessable("Укажите размер DOCX");
    if (length > MAX_MULTIPART_BYTES) throw new PayloadTooLarge("DOCX больше 5 МБ");
    if (req.aborted || res.destroyed) throw new Unprocessable("Загрузка DOCX прервана");
    const now = Date.now();
    for (const [id, state] of requests) if (now - state.started >= WINDOW_MS) requests.delete(id);
    const state = requests.get(actor.id);
    if (state && state.count >= LIMIT_PER_ACTOR) throw new TooManyRequests("Слишком много попыток разбора DOCX. Повторите через минуту");
    if (parsingReserved) throw new TooManyRequests("Разбор другого DOCX ещё выполняется. Повторите позже");
    requests.set(actor.id, state ? { ...state, count: state.count + 1 } : { started: now, count: 1 });
    parsingReserved = true;
    let released = false;
    let processing = false;
    const abortController = new AbortController();
    const release = () => { if (!released) { released = true; parsingReserved = false; } };
    const onDisconnect = () => {
      abortController.abort();
      if (!processing) release();
    };
    req.once("aborted", onDisconnect);
    res.once("close", () => { if (!res.writableFinished) onDisconnect(); else if (!processing) release(); });
    res.once("finish", () => { if (!processing) release(); });
    res.locals.wordImportLifecycle = { signal: abortController.signal, start: () => { processing = true; }, release } satisfies PreviewLifecycle;
    res.locals.wordSnapshot = snapshot;
    next();
  };

  upload = upload;

  preview = async (req: Request, res: Response) => {
    const lifecycle = res.locals.wordImportLifecycle as PreviewLifecycle;
    lifecycle.start();
    try {
    if (Object.keys(req.body ?? {}).length || Object.keys(req.files ?? {}).some((name) => name !== "file"))
      throw new Unprocessable("Допускается только один DOCX в поле file");
    const file = req.files?.file;
    if (!file || Array.isArray(file) || !Buffer.isBuffer(file.data)) throw new Unprocessable("Выберите один DOCX");
    if (file.truncated || file.size > MAX_DOCX_BYTES) throw new PayloadTooLarge("DOCX больше 5 МБ");
    if (!file.name.toLowerCase().endsWith(".docx") || file.name.length > 200) throw new Unprocessable("Ожидается файл .docx");
    if (lifecycle.signal.aborted) throw new Unprocessable("Загрузка DOCX прервана");
    await inspectDocx(file.data);
    if (lifecycle.signal.aborted) throw new Unprocessable("Загрузка DOCX прервана");
    const parsed = await parseWord(file.data, file.name, lifecycle.signal);
    const snapshot = res.locals.wordSnapshot as { targetTemplateId: number; targetRevision: string };
    res.set("Cache-Control", "no-store");
    res.json({ targetTemplateId: snapshot.targetTemplateId, targetRevision: snapshot.targetRevision,
      source: parsed.source, values: parsed.values, availableFields: Object.keys(parsed.values), warnings: parsed.warnings });
    } finally { lifecycle.release(); }
  };

  apply = async (req: Request, res: Response) => {
    if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body)
      || Buffer.byteLength(JSON.stringify(req.body)) > MAX_APPLY_BYTES) throw new Unprocessable("Некорректный или слишком большой JSON импорта");
    res.set("Cache-Control", "no-store");
    res.json(await this.imports.wordApply(TemplateAccess.actor(req.user), req.params.id, req.body as Record<string, unknown>));
  };
}
