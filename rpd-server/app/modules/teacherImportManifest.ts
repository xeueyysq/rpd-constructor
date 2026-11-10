import { createHmac, timingSafeEqual } from "node:crypto";
import { Unprocessable } from "../utils/Errors.ts";
import type { UserClaims } from "../types/express.ts";

const PURPOSE = "1c-teacher-import-v1";
const LIFETIME_MS = 15 * 60 * 1000;

function signature(body: string): Buffer {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("Не настроен секрет подписи импорта");
  // Отдельный ключ/домен. Это не auth JWT, манифест нельзя использовать для входа.
  const key = createHmac("sha256", secret).update("rpd:teacher-import:manifest-key:v1").digest();
  return createHmac("sha256", key).update(body).digest();
}

export function issueTeacherImportManifest(names: string[], complectId: number, actor: UserClaims): string {
  const body = Buffer.from(JSON.stringify({ purpose: PURPOSE, actorId: actor.id, complectId,
    expiresAt: Date.now() + LIFETIME_MS, names: [...new Set(names)] })).toString("base64url");
  return `${body}.${signature(body).toString("base64url")}`;
}

export function verifyTeacherImportManifest(manifest: unknown, complectId: number, actor: UserClaims): string[] {
  const invalid = () => new Unprocessable("Данные импорта недействительны или устарели. Загрузите план из 1С заново");
  if (typeof manifest !== "string" || manifest.length > 256_000) throw invalid();
  const [body, mac, extra] = manifest.split(".");
  if (!body || !mac || extra !== undefined || !/^[\w-]+$/.test(body) || !/^[\w-]+$/.test(mac)) throw invalid();
  const received = Buffer.from(mac, "base64url");
  const expected = signature(body);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw invalid();
  let data: unknown;
  try { data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw invalid(); }
  if (!data || typeof data !== "object") throw invalid();
  const record = data as Record<string, unknown>;
  if (record.purpose !== PURPOSE || record.actorId !== actor.id || record.complectId !== complectId
    || typeof record.expiresAt !== "number" || !Number.isSafeInteger(record.expiresAt)
    || record.expiresAt <= Date.now() || record.expiresAt > Date.now() + LIFETIME_MS
    || !Array.isArray(record.names) || !record.names.every((name) => typeof name === "string")) throw invalid();
  return record.names;
}
