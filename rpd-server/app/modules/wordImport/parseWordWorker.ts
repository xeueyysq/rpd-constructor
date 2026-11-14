import { parentPort, workerData } from "node:worker_threads";
import { buildFullDocumentResult } from "../wordParser/lib/parser/full-document-parser.ts";
import { adaptWordResult } from "./wordAdapter.ts";

const input = workerData as { bytes: Uint8Array; fileName: string };
try {
  const bytes = input.bytes;
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const result = await buildFullDocumentResult(data, input.fileName);
  parentPort?.postMessage({ ok: true, preview: adaptWordResult(result) });
} catch (error) {
  parentPort?.postMessage({ ok: false, message: error && typeof error === "object" && "error" in error
    ? String(error.error) : "Не удалось разобрать рабочую программу DOCX" });
}
