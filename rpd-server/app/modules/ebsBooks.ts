import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import { BadGateway, TooManyRequests } from "../utils/Errors.ts";
import type { Book, BookRequest, BookSearchResult } from "./findBooks.ts";

type EbsSource = "lan" | "urait";
const names = { lan: "«Лань»", urait: "«Юрайт»" };
const LAN_PAGE_SIZE = 1000;
const MAX_BOOKS = 100_000;
const MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const CACHE_TTL = 15 * 60_000;
const RETRY_DELAY = 30_000;
const INCOMPLETE = "Не удалось полностью загрузить каталог «Лань». Попробуйте позже или обратитесь к администратору.";

let snapshot: { key: string; expiresAt: number; books: Book[] } | undefined;
let loading: { key: string; promise: Promise<Book[]> } | undefined;
let failed: { key: string; retryAt: number } | undefined;
let activeRequests = 0;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Invalid catalog response");
  return value as Record<string, unknown>;
}

function plainText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > 16_000) throw new Error("Invalid catalog text");
  const html = value.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>|<\/?(?:p|div|li|h[1-6])\b[^>]*>/gi, " ");
  // Парсер работает без сети; сообщения о внешних данных не попадают в журнал.
  const doc = new DOMParser({ onError: () => {} }).parseFromString(`<div>${html}</div>`, "text/html");
  return (doc.documentElement?.textContent ?? "").replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\s+/g, " ").trim();
}

function safeUrl(value: unknown, source: EbsSource): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const domain = source === "lan" ? "lanbook.com" : "urait.ru";
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port
      || !(url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null;
    return url.href;
  } catch { return null; }
}

function normalizeEbsBook(raw: unknown, source: EbsSource): Book {
  const item = record(raw);
  const rawId = source === "lan" ? item.id : item.content_id;
  if (!(typeof rawId === "string" && /^[\w-]{1,128}$/.test(rawId))
    && !(typeof rawId === "number" && Number.isSafeInteger(rawId) && rawId > 0)) throw new Error("Invalid book id");
  const title = plainText(source === "lan" ? item.name : item.content_name);
  const author = plainText(item.authors) || null;
  const year = /^\d{4}$/.test(String(item.year)) ? Number(item.year) : null;
  if (!title) throw new Error("Missing book title");
  const publication = source === "urait" ? [plainText(item.publisher), year].filter(Boolean).join(", ") : "";
  const isbn = source === "urait" ? plainText(item.isbn) : "";
  const biblio = source === "lan" ? plainText(item.bibliographicRecord)
    : `${title}${author ? ` / ${author}` : ""}${publication ? ` — ${publication}.` : "."}${isbn ? ` — ISBN ${isbn}.` : ""}`;
  if (!biblio) throw new Error("Missing bibliography");
  return {
    id: `${source}:${rawId}`, title, author, year, biblio,
    url: safeUrl(item.url, source), thumb: safeUrl(source === "lan" ? item.thumb : item.image, source),
  };
}

async function request(get: BookRequest, url: string, params: Record<string, string | number>, signal: AbortSignal, token?: string): Promise<unknown> {
  if (activeRequests >= 4) throw new TooManyRequests("Поиск в ЭБС занят. Попробуйте позже.");
  activeRequests++;
  try {
    return (await get(url, {
      params, timeout: 10_000, maxRedirects: 0, maxContentLength: 4 * 1024 * 1024,
      signal, responseType: "json", headers: { Accept: "application/json", ...(token ? { "X-Auth-Token": token } : {}) },
    })).data;
  } finally { activeRequests--; }
}

async function loadLan(token: string, get: BookRequest): Promise<Book[]> {
  const signal = AbortSignal.timeout(60_000);
  const books: Book[] = [];
  const ids = new Set<string>();
  let total: number | undefined;
  let bytes = 0;
  let pages = 0;
  // Последовательная пагинация учитывает и сервер, возвращающий меньше limit.
  do {
    if (++pages > 200) throw new BadGateway(INCOMPLETE);
    const data = record(await request(get, "https://openapi.e.lanbook.com/1.0/resource/book", {
      limit: LAN_PAGE_SIZE, offset: books.length, fields: "name,authors,year,bibliographicRecord,url,thumb",
    }, signal, token));
    if (data.status !== 200 || !Number.isSafeInteger(data.count) || (data.count as number) < 0
      || (data.count as number) > MAX_BOOKS || !Array.isArray(data.data)
      || data.data.length > LAN_PAGE_SIZE || (total !== undefined && total !== data.count)) throw new BadGateway(INCOMPLETE);
    total = data.count as number;
    if ((!data.data.length && books.length < total) || books.length + data.data.length > total) throw new BadGateway(INCOMPLETE);
    for (const raw of data.data) {
      const book = normalizeEbsBook(raw, "lan");
      if (ids.has(book.id)) throw new BadGateway(INCOMPLETE);
      ids.add(book.id);
      bytes += Buffer.byteLength(JSON.stringify(book));
      if (bytes > MAX_SNAPSHOT_BYTES) throw new BadGateway(INCOMPLETE);
      books.push(book);
    }
  } while (books.length < total);
  return books;
}

async function lanCatalog(token: string, get: BookRequest): Promise<Book[]> {
  const key = createHash("sha256").update(token).digest("hex");
  if (snapshot?.key === key && snapshot.expiresAt > Date.now()) return snapshot.books;
  snapshot = undefined;
  if (loading) {
    if (loading.key === key) return loading.promise;
    throw new TooManyRequests("Каталог «Лань» обновляется. Попробуйте позже.");
  }
  if (failed?.key === key && failed.retryAt > Date.now()) throw new BadGateway(INCOMPLETE);
  const promise = loadLan(token, get);
  loading = { key, promise };
  try {
    const books = await promise;
    snapshot = { key, expiresAt: Date.now() + CACHE_TTL, books };
    failed = undefined;
    return books;
  } catch (error) {
    failed = { key, retryAt: Date.now() + RETRY_DELAY };
    throw error;
  } finally { loading = undefined; }
}

export async function searchEbsBooks(query: string, source: EbsSource, get: BookRequest): Promise<BookSearchResult> {
  const token = source === "lan" ? process.env.EBS_LAN_TOKEN?.trim() : process.env.EBS_URAIT_API_KEY?.trim();
  const partner = source === "urait" ? process.env.EBS_URAIT_PARTNER_ID?.trim() : undefined;
  if (!token || (source === "urait" && !partner)) throw new BadGateway(`Поиск в ${names[source]} не настроен. Обратитесь к администратору.`);
  try {
    if (source === "lan") {
      const catalog = await lanCatalog(token, get);
      const normalized = (text: string) => text.toLowerCase().replace(/ё/g, "е");
      const words = normalized(query).split(/\s+/).filter(Boolean);
      return { books: catalog.filter((book) => words.every((word) => normalized(`${book.title} ${book.author ?? ""} ${book.year ?? ""}`).includes(word))), truncated: false };
    }
    const time = Math.floor(Date.now() / 1000);
    const sign = createHash("md5").update(`${partner}:${token}:${time}`).digest("hex");
    const data = record(await request(get, "https://urait.ru/partner-api/contents", {
      partner_id: partner!, time, sign, query, limit: 100, offset: 0,
    }, AbortSignal.timeout(10_000)));
    if (data.status !== "success" || !Number.isSafeInteger(data.total) || (data.total as number) < 0
      || !Array.isArray(data.contents) || data.contents.length > 100 || data.contents.length > (data.total as number)
      || (!data.contents.length && data.total !== 0)) throw new Error("Invalid catalog response");
    return { books: data.contents.map((item) => normalizeEbsBook(item, "urait")), truncated: (data.total as number) > data.contents.length };
  } catch (error) {
    if (error instanceof BadGateway || error instanceof TooManyRequests) throw error;
    const timeout = typeof error === "object" && error !== null && "code" in error
      && ["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED"].includes(String(error.code));
    // Axios error содержит заголовки/подпись; наружу и в журнал передаётся только свой текст.
    throw new BadGateway(timeout ? `Каталог ${names[source]} не ответил вовремя. Попробуйте позже.`
      : source === "lan" ? INCOMPLETE : `Каталог ${names[source]} недоступен. Попробуйте позже.`);
  }
}
