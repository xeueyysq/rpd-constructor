import type { ParamsDictionary } from "express-serve-static-core";
import type { Request, Response } from "express";
import axios from "axios";
import { BadGateway, Unprocessable } from "../utils/Errors.ts";

export type Book = {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  url: string | null;
  thumb: string | null;
  biblio: string;
};

export type BookSearchResult = { books: Book[]; truncated: boolean };
type BookRequest = (url: string, config: { timeout: number }) => Promise<{ data: unknown }>;

// ponytail: MegaPro соблюдает limit только до 100, больше — игнорирует и отдаёт до 1000 записей за ~15 с; ранжируем окно из 100, при truncated клиент просит уточнить запрос. Апгрейд — API с сортировкой или поиском по полям.
const LIMIT = 100;
const TIMEOUT = 10_000;
const UNAVAILABLE = "Каталог библиотеки недоступен. Попробуйте позже.";
const TIMED_OUT = "Каталог библиотеки не ответил вовремя. Уточните запрос или попробуйте позже.";

export function biblioText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<\/?b>/gi, "").replace(/\s+/g, " ").trim();
}

const libraryUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().replace(/^http:\/\/lib\.uni-dubna\.ru\//i, "https://lib.uni-dubna.ru/");
};

export function normalizeBook(raw: unknown): Book | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.biblio !== "string") return null;
  const biblio = biblioText(entry.biblio);
  if (!biblio) return null;

  const years = typeof entry.published === "string" ? entry.published.match(/1[5-9]\d\d|20\d\d/g) : null;
  const url = libraryUrl(entry.url);
  return {
    id: url ?? biblio,
    title: typeof entry.title === "string" ? entry.title.trim() : "",
    author: typeof entry.author === "string" ? entry.author.trim() || null : null,
    year: years ? Number(years[years.length - 1]) : null,
    url,
    thumb: libraryUrl(entry.thumb),
    biblio,
  };
}

const normalizedText = (value: string): string => value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

export function dedupeBooks(books: Book[]): Book[] {
  const seen = new Set<string>();
  return books.filter((book) => {
    const key = normalizedText(book.biblio);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rankBooks(books: Book[], query: string): Book[] {
  // ponytail: обрезка двух букв у длинных слов — простой стемминг; при ошибках ранжирования заменить морфологическим анализом.
  const stems = normalizedText(query).split(" ").filter(Boolean).map((token) => token.length >= 6 ? token.slice(0, -2) : token);
  const scored = books.map((book, index) => {
    const title = normalizedText(book.title);
    const author = normalizedText(book.author ?? "");
    return {
      book,
      index,
      allCovered: stems.every((stem) => `${title} ${author}`.includes(stem)),
      titleHits: stems.filter((stem) => title.includes(stem)).length,
      authorHits: stems.filter((stem) => author.includes(stem)).length,
    };
  });
  scored.sort((a, b) => Number(b.allCovered) - Number(a.allCovered)
    || b.titleHits - a.titleHits
    || b.authorHits - a.authorHits
    || (b.book.year ?? -Infinity) - (a.book.year ?? -Infinity)
    || a.index - b.index);
  return scored.map(({ book }) => book);
}

const isTimeout = (error: unknown): boolean => typeof error === "object" && error !== null
  && "code" in error && (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT");

export async function searchBooks(query: string, get: BookRequest = axios.get): Promise<BookSearchResult> {
  const url = new URL("https://lib.uni-dubna.ru/MegaPro/API");
  url.searchParams.set("Method", "LIC_Search");
  url.searchParams.set("query", query);
  url.searchParams.set("inFulltext", "false");
  url.searchParams.set("limit", String(LIMIT));

  // ponytail: пока запросы не кэшируются; если повторы создадут нагрузку, добавить ограниченный LRU.
  let data: unknown;
  try {
    ({ data } = await get(url.toString(), { timeout: TIMEOUT }));
  } catch (error) {
    console.error("Ошибка запроса к MegaPro:", error instanceof Error ? error.message : error);
    throw new BadGateway(isTimeout(error) ? TIMED_OUT : UNAVAILABLE);
  }
  if (!Array.isArray(data)) {
    if (typeof data === "object" && data !== null && "ErrorMessage" in data) {
      console.error("Ошибка каталога MegaPro:", data.ErrorMessage);
    }
    throw new BadGateway(UNAVAILABLE);
  }

  const books = data.map(normalizeBook).filter((book): book is Book => book !== null);
  return { books: rankBooks(dedupeBooks(books), query), truncated: data.length >= LIMIT };
}

export function parseBookName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
    throw new Unprocessable("Введите запрос для поиска");
  }
  return value.trim();
}

const findBooks = async (req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) => {
  const query = parseBookName(req.body?.bookName);
  res.json(await searchBooks(query));
};

export default findBooks;
