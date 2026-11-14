import { Worker } from "node:worker_threads";
import { Unprocessable } from "../../utils/Errors.ts";
import type { WordValues } from "./wordAdapter.ts";

export type WordParsedPreview = { values: WordValues; warnings: string[]; source: { fileName: string; discipline: string | null; department: string | null; year: number | null } };

export async function parseWord(buffer: Buffer, fileName: string, signal?: AbortSignal): Promise<WordParsedPreview> {
  const bytes = Uint8Array.from(buffer);
  return new Promise<WordParsedPreview>((resolve, reject) => {
    const worker = new Worker(new URL("./parseWordWorker.ts", import.meta.url), {
      workerData: { bytes, fileName }, transferList: [bytes.buffer], execArgv: [], env: {},
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = async (error?: unknown, preview?: WordParsedPreview) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      try { await worker.terminate(); } catch { /* worker already exited */ }
      if (error) reject(error);
      else if (preview) resolve(preview);
      else reject(new Unprocessable("Не удалось разобрать DOCX"));
    };
    const abort = () => { void finish(new Unprocessable("Загрузка DOCX прервана")); };
    const timeout = setTimeout(() => finish(new Unprocessable("Разбор DOCX занял слишком много времени")), 10_000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    worker.on("message", (value: unknown) => {
      if (value && typeof value === "object" && "ok" in value && value.ok === true && "preview" in value)
        void finish(undefined, value.preview as WordParsedPreview);
      else if (value && typeof value === "object" && "message" in value) void finish(new Unprocessable(String(value.message)));
      else void finish(new Unprocessable("Не удалось разобрать DOCX"));
    });
    worker.on("error", () => { void finish(new Unprocessable("Не удалось разобрать DOCX")); });
    worker.on("exit", (code) => { if (!settled) void finish(new Unprocessable(code === 0 ? "Не удалось разобрать DOCX" : "Разбор DOCX прерван")); });
  });
}
