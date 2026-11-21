import test from "node:test";
import assert from "node:assert/strict";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import router from "../app/routes/routes.ts";
import {
  biblioText,
  normalizeBook,
  parseBookName,
  rankBooks,
  searchBooks,
  type Book,
  type BookRequest,
  type BookSource,
} from "../app/modules/findBooks.ts";

const book = (id: string, title: string, year: number | null, author: string | null = null): Book => ({
  id, title, author, year, url: null, thumb: null, biblio: id,
});

test("запрос кодирует спецсимволы и задаёт параметры MegaPro и таймаут", async () => {
  const requests: { url: string; timeout: number }[] = [];
  const get = async (url: string, config: { timeout: number }) => {
    requests.push({ url, timeout: config.timeout });
    return { data: [] };
  };

  await searchBooks("C++", get);
  await searchBooks("R&D", get);

  assert.match(requests[0].url, /[?&]query=C%2B%2B(?:&|$)/);
  assert.match(requests[1].url, /[?&]query=R%26D(?:&|$)/);
  for (const request of requests) {
    const url = new URL(request.url);
    assert.equal(url.origin + url.pathname, "https://lib.uni-dubna.ru/MegaPro/API");
    assert.equal(url.searchParams.get("Method"), "LIC_Search");
    assert.equal(url.searchParams.get("inFulltext"), "false");
    assert.equal(url.searchParams.get("limit"), "100");
    assert.equal(request.timeout, 10_000);
  }
});

test("библиографическое описание сохраняет текст внутри b и сырые знаки", () => {
  assert.equal(
    biblioText('<b>Виноградов, В. А.</b><br>   База данных "Языки мира" … / В. А. Виноградов<br>// Вопросы языкознания. — 2003.'),
    'Виноградов, В. А. База данных "Языки мира" … / В. А. Виноградов // Вопросы языкознания. — 2003.',
  );
  assert.equal(biblioText("   <b>EBSCO</b> : [databases] / EBSCO Industries …"), "EBSCO : [databases] / EBSCO Industries …");
  assert.equal(biblioText(" A < B & C<BR />  <B>Заголовок</B>  "), "A < B & C Заголовок");
});

test("нормализация извлекает год, автора, ссылки и отбрасывает мусор", () => {
  const first = normalizeBook({
    title: "  Название  ", author: "  Автор  ", published: "2003", biblio: "  Описание  ",
    url: "http://lib.uni-dubna.ru/MegaPRO/UserEntry/1", thumb: "http://lib.uni-dubna.ru/MegaPRO/DownLoad/1",
  });
  assert.deepEqual(first, {
    id: "https://lib.uni-dubna.ru/MegaPRO/UserEntry/1", title: "Название", author: "Автор", year: 2003,
    url: "https://lib.uni-dubna.ru/MegaPRO/UserEntry/1", thumb: "https://lib.uni-dubna.ru/MegaPRO/DownLoad/1", biblio: "Описание",
  });
  assert.equal(normalizeBook({ biblio: "Издание", published: "Москва, 1999" })?.year, 1999);
  assert.deepEqual(normalizeBook({ biblio: "Без автора" }), {
    id: "Без автора", title: "", author: null, year: null, url: null, thumb: null, biblio: "Без автора",
  });
  assert.equal(normalizeBook(null), null);
  assert.equal(normalizeBook([]), null);
  assert.equal(normalizeBook({ biblio: "<br>  </b>" }), null);
});

test("дубликаты описания схлопываются, разные годы остаются", async () => {
  const data = [
    { title: "Алгоритмы", published: "2004", biblio: "  Ёлка  :  алгоритмы — 2004 " },
    { title: "Алгоритмы", published: "2004", biblio: "елка : алгоритмы — 2004" },
    { title: "Алгоритмы", published: "2010", biblio: "Елка : алгоритмы — 2010" },
  ];
  const result = await searchBooks("алгоритмы", async () => ({ data }));
  assert.equal(result.books.length, 2);
  assert.deepEqual(result.books.map(({ year }) => year), [2010, 2004]);
});

test("ранжирование учитывает все слова, заглавие, автора, год и исходный порядок", () => {
  const keywordOnly = book("keywords", "Справочник", 2024);
  const partial = book("partial", "Алгебра и анализ", 2022);
  const old = book("old", "Курс математического анализа", 1933);
  const recent = book("recent", "Математический анализ", 2021);
  const source = [keywordOnly, partial, old, recent];

  assert.deepEqual(rankBooks(source, "математический анализ").map(({ id }) => id), ["recent", "old", "partial", "keywords"]);
  assert.deepEqual(rankBooks([recent, { ...old, author: "Фихтенгольц" }], "Фихтенгольц математический анализ").map(({ id }) => id), ["old", "recent"]);
  assert.deepEqual(rankBooks([book("first", "C++", null), book("second", "C++", null)], "C++").map(({ id }) => id), ["first", "second"]);
});

test("признак усечения считается до удаления дубликатов", async () => {
  const raw = Array.from({ length: 100 }, () => ({ biblio: "Одна книга" }));
  const full = await searchBooks("книга", async () => ({ data: raw }));
  const shorter = await searchBooks("книга", async () => ({ data: raw.slice(0, 99) }));
  assert.equal(full.truncated, true);
  assert.equal(full.books.length, 1);
  assert.equal(shorter.truncated, false);
});

test("ошибки каталога дают 502 без передачи его текста клиенту", async (t) => {
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args); });
  const unavailable = { status: 502, error: "Каталог библиотеки недоступен. Попробуйте позже." };
  const timedOut = { status: 502, error: "Каталог библиотеки не ответил вовремя. Уточните запрос или попробуйте позже." };

  await assert.rejects(searchBooks("книга", async () => ({ data: { ErrorMessage: "Секретная ошибка" } })), unavailable);
  assert.deepEqual(logs[0], ["Ошибка каталога MegaPro:", "Секретная ошибка"]);
  await assert.rejects(searchBooks("книга", async () => ({ data: "не массив" })), unavailable);
  await assert.rejects(searchBooks("книга", async () => { throw { code: "ECONNABORTED" }; }), timedOut);
  await assert.rejects(searchBooks("книга", async () => { throw { code: "ETIMEDOUT" }; }), timedOut);
  await assert.rejects(searchBooks("книга", async () => { throw new Error("Сеть недоступна"); }), unavailable);
  assert.deepEqual(logs.slice(1), [
    ["Ошибка запроса к MegaPro:", { code: "ECONNABORTED" }],
    ["Ошибка запроса к MegaPro:", { code: "ETIMEDOUT" }],
    ["Ошибка запроса к MegaPro:", "Сеть недоступна"],
  ]);
});

test("поисковая строка обрезается и ограничивается 200 символами", () => {
  assert.equal(parseBookName("  книга  "), "книга");
  for (const value of [undefined, null, 42, "  ", "a".repeat(201)]) {
    assert.throws(() => parseBookName(value), { status: 422, error: "Введите запрос для поиска" });
  }
});

const lanBook = (id: number, name = "Ёлка", year = 2026) => ({
  id, name, authors: "Иванов И. И.", year, bibliographicRecord: `${name}. ${year}.`,
  url: `https://e.lanbook.com/book/${id}`, thumb: `https://cdn.lanbook.com/${id}.jpg`,
});
const uraitBook = {
  content_id: "37F6EAD7-6F14-4091-86E8-DC837162AE98", content_name: "<b>Лесное право</b>",
  authors: "Быковский В. К.", year: 2021, publisher: "М.:Издательство Юрайт", isbn: "978-5-534-15110-7",
  url: "https://urait.ru/author-course/lesnoe-pravo-rossii-487443",
  image: "https://urait.ru/book/cover/37F6EAD7-6F14-4091-86E8-DC837162AE98",
};
const clearEbsCredentials = () => {
  delete process.env.EBS_LAN_TOKEN;
  delete process.env.EBS_URAIT_PARTNER_ID;
  delete process.env.EBS_URAIT_API_KEY;
};

test("Лань: общий count, поиск за первой страницей, полный снимок, dedupe/rank, общий кэш и TTL", async (t) => {
  process.env.EBS_LAN_TOKEN = "fixture-lan-pagination";
  t.after(clearEbsCredentials);
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  const offsets: number[] = [];
  const recent = { ...lanBook(3), name: "<b>Ёлка</b>", authors: "Иванов&nbsp;И. И.",
    bibliographicRecord: '<p>Ёлка &amp; лес.</p><script>secret()</script><a href="javascript:alert(1)">Иванов</a><br>2026.',
    url: "javascript:alert(1)", thumb: "https://lanbook.com.evil.invalid/cover" };
  const get: BookRequest = async (url, config) => {
    assert.equal(url, "https://openapi.e.lanbook.com/1.0/resource/book");
    assert.deepEqual(config.headers, { Accept: "application/json", "X-Auth-Token": "fixture-lan-pagination" });
    assert.equal(config.params?.fields, "name,authors,year,bibliographicRecord,url,thumb");
    assert.equal(config.params.limit, 1000);
    assert.equal(config.timeout, 10_000);
    assert.equal(config.maxRedirects, 0);
    assert.equal(config.maxContentLength, 4 * 1024 * 1024);
    assert.ok(config.signal instanceof AbortSignal);
    const offset = Number(config.params.offset);
    offsets.push(offset);
    return { data: { status: 200, count: 4, data: offset === 0 ? [lanBook(1, "Другая книга")]
      : [lanBook(2, "Ёлка", 2020), recent, { ...recent, id: 4 }] } };
  };
  const [result, concurrent] = await Promise.all([
    searchBooks("елка ИВАНОВ", get, "lan"), searchBooks("елка ИВАНОВ", get, "lan"),
  ]);
  assert.deepEqual(offsets, [0, 1]);
  assert.deepEqual(concurrent, result);
  assert.deepEqual(result.books.map(({ id }) => id), ["lan:3", "lan:2"]);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.books[0], {
    id: "lan:3", title: "Ёлка", author: "Иванов И. И.", year: 2026, url: null, thumb: null,
    biblio: "Ёлка & лес. Иванов 2026.",
  });
  assert.equal(result.books[1].url, "https://e.lanbook.com/book/2");
  assert.deepEqual((await searchBooks("елка ИВАНОВ 2020", get, "lan")).books.map(({ id }) => id), ["lan:2"]);
  assert.deepEqual(await searchBooks("несуществующая", get, "lan"), { books: [], truncated: false });
  assert.deepEqual(offsets, [0, 1], "другой запрос фильтрует готовый снимок без сети");

  now += 15 * 60_000 + 1;
  let attempts = 0;
  const broken: BookRequest = async () => { attempts++; return { data: { status: 500, message: "fixture-lan-pagination" } }; };
  await assert.rejects(searchBooks("Ёлка", broken, "lan"), { status: 502, error: /полностью загрузить/ });
  await assert.rejects(searchBooks("Ёлка", broken, "lan"), { status: 502 });
  assert.equal(attempts, 1, "ошибка не выдаёт просроченный снимок и ограничивает частоту повторов");
  now += 30_001;
  assert.equal((await searchBooks("Ёлка", get, "lan")).books.length, 2);
  assert.deepEqual(offsets, [0, 1, 0, 1]);
  process.env.EBS_LAN_TOKEN = "fixture-lan-result-window";
  const window = await searchBooks("Ёлка", async () => ({ data: { status: 200, count: 101,
    data: Array.from({ length: 101 }, (_, index) => lanBook(index + 1, `Ёлка ${index}`)) } }), "lan");
  assert.equal(window.books.length, 100);
  assert.equal(window.truncated, true);
});

test("Лань не выдаёт частичный каталог при дрейфе count, повторе страниц, мусоре и превышении пределов", async (t) => {
  t.after(clearEbsCredentials);
  const invalidPages: unknown[] = [
    { status: 200, count: 3, data: [lanBook(2)] },
    { status: 200, count: 2, data: [] },
    { status: 200, count: 2, data: [lanBook(1)] },
    { status: 200, count: 2, data: [{ id: 2, name: "Книга" }] },
    { status: 200, count: 100_001, data: [] },
    { status: 200, count: "2", data: [lanBook(2)] },
    { status: 200, count: 2, data: [lanBook(2), lanBook(3)] },
  ];
  for (const [index, page] of invalidPages.entries()) {
    process.env.EBS_LAN_TOKEN = `fixture-lan-incomplete-${index}`;
    const get: BookRequest = async (_url, config) => ({ data: config.params?.offset === 0
      ? { status: 200, count: 2, data: [lanBook(1)] } : page });
    await assert.rejects(searchBooks("Ёлка", get, "lan"), { status: 502, error: /полностью загрузить/ });
  }
});

test("Юрайт: официальный подписанный GET, total, простой biblio и безопасные ссылки", async (t) => {
  process.env.EBS_URAIT_PARTNER_ID = "fixture-partner";
  process.env.EBS_URAIT_API_KEY = "fixture-api-key";
  t.after(clearEbsCredentials);
  t.mock.method(Date, "now", () => 1_800_000_000_000);
  const invalidUrls = ["javascript:alert(1)", "data:text/html,hello", "//urait.ru/book", "https://urait.ru.evil.invalid/book", "https://user:pass@urait.ru/book", "https://urait.ru:444/book", "https://evil.invalid/book"];
  const result = await searchBooks("Лесное право & C++", async (url, config) => {
    assert.equal(url, "https://urait.ru/partner-api/contents");
    assert.deepEqual(config.params, {
      partner_id: "fixture-partner", time: 1_800_000_000, sign: "0f401339eb65b718b7fa48cfa8d027a1",
      query: "Лесное право & C++", limit: 100, offset: 0,
    });
    assert.deepEqual(config.headers, { Accept: "application/json" });
    assert.equal(config.maxRedirects, 0);
    assert.equal(config.timeout, 10_000);
    return { data: { status: "success", total: 10507, contents: [uraitBook,
      ...invalidUrls.map((url, index) => ({ ...uraitBook, content_id: `fixture-${index}`, url, image: url, content_name: `Учебник ${index}` }))] } };
  }, "urait");
  assert.equal(result.truncated, true);
  assert.deepEqual(result.books[0], {
    id: "urait:37F6EAD7-6F14-4091-86E8-DC837162AE98", title: "Лесное право", author: "Быковский В. К.", year: 2021,
    url: uraitBook.url, thumb: uraitBook.image,
    biblio: "Лесное право / Быковский В. К. — М.:Издательство Юрайт, 2021. — ISBN 978-5-534-15110-7.",
  });
  assert.ok(result.books.slice(1).every(({ url, thumb }) => url === null && thumb === null));
  assert.deepEqual(await searchBooks("нет", async () => ({ data: { status: "success", total: 0, contents: [] } }), "urait"), { books: [], truncated: false });
});

test("ЭБС: неверный ответ и timeout не передают реквизиты/URL в ответ или журнал", async (t) => {
  t.after(clearEbsCredentials);
  const logs = t.mock.method(console, "error", () => {});
  const marker = "fixture-sensitive-marker";
  process.env.EBS_URAIT_PARTNER_ID = marker;
  process.env.EBS_URAIT_API_KEY = marker;
  for (const source of ["lan", "urait"] as const) {
    const invalidResponses = source === "lan" ? [null, { status: 403, message: marker }] : [null, { status: "error", message: marker },
      { status: "success", total: -1, contents: [] }, { status: "success", total: 1, contents: [{}] },
      { status: "success", total: 1, contents: [] }, { status: "success", total: 0, contents: [uraitBook] },
      { status: "success", total: "1", contents: [uraitBook] }];
    for (const [index, response] of invalidResponses.entries()) {
      process.env.EBS_LAN_TOKEN = `${marker}-${source}-${index}`;
      await assert.rejects(searchBooks("книга", async () => ({ data: response }), source), (error) => {
        assert.equal((error as { status: number }).status, 502);
        assert.ok(!JSON.stringify(error).includes(marker));
        return true;
      });
    }
    for (const code of ["ECONNABORTED", "ETIMEDOUT", "ERR_CANCELED"]) {
      process.env.EBS_LAN_TOKEN = `${marker}-${code}`;
      await assert.rejects(searchBooks("книга", async () => {
        throw Object.assign(new Error(`https://urait.ru/?sign=${marker}`), { code, config: { headers: { "X-Auth-Token": marker } } });
      }, source), { status: 502, error: /не ответил вовремя/ });
    }
  }
  assert.equal(logs.mock.callCount(), 0);
});

test("ЭБС ограничивает параллельные обращения и освобождает слоты", async (t) => {
  process.env.EBS_URAIT_PARTNER_ID = "fixture-partner";
  process.env.EBS_URAIT_API_KEY = "fixture-api-key";
  t.after(clearEbsCredentials);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const get: BookRequest = async () => { await gate; return { data: { status: "success", total: 0, contents: [] } }; };
  const pending = Array.from({ length: 4 }, () => searchBooks("книга", get, "urait"));
  try { await assert.rejects(searchBooks("книга", get, "urait"), { status: 429 }); }
  finally { release(); }
  await Promise.all(pending);
  assert.deepEqual(await searchBooks("книга", get, "urait"), { books: [], truncated: false });
});

// Реальные router/JWT/express.json без сетевого listener и без БД.
function searchRequest(app: express.Express, body: unknown, role?: number): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = "POST";
    req.url = "/api/find-books";
    if (role !== undefined) req.headers.authorization = `Bearer ${jwt.sign({ id: 42, role, userName: "fixture" }, "fixture-search-auth")}`;
    const data = JSON.stringify(body);
    req.headers["content-type"] = "application/json";
    req.headers["content-length"] = String(Buffer.byteLength(data));
    const res = new ServerResponse(req);
    res.end = ((chunk?: unknown) => {
      try { resolve({ status: res.statusCode, body: chunk ? JSON.parse(String(chunk)) : {} }); }
      catch (error) { reject(error); }
      return res;
    }) as typeof res.end;
    app(req, res);
    req.push(data);
    req.push(null);
  });
}

test("поиск HTTP: JWT/роли, allowlist, отсутствие ключей и прежний default MegaPro", async (t) => {
  clearEbsCredentials();
  process.env.ACCESS_TOKEN_SECRET = "fixture-search-auth";
  t.after(() => { clearEbsCredentials(); delete process.env.ACCESS_TOKEN_SECRET; });
  const upstream = t.mock.method(axios, "get", async () => ({ data: [{ biblio: "Прежняя книга" }] }));
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(((error, _req, res, next) => { void next; res.status(error.status ?? 500).json(error); }) as ErrorRequestHandler);
  for (const source of [undefined, "lan", "urait"] as const) {
    assert.equal((await searchRequest(app, { bookName: "книга", source })).status, 401);
    assert.equal((await searchRequest(app, { bookName: "книга", source }, 99)).status, 403);
  }
  for (const source of [null, 42, [], {}, "https://evil.invalid", "LAN"]) {
    assert.equal((await searchRequest(app, { bookName: "книга", source }, 2)).status, 422);
  }
  for (const source of ["lan", "urait"] as BookSource[]) {
    const response = await searchRequest(app, { bookName: "книга", source }, 2);
    assert.equal(response.status, 502);
    assert.match(JSON.stringify(response.body), /не настроен/);
  }
  process.env.EBS_URAIT_PARTNER_ID = "fixture-partner-without-key";
  assert.equal((await searchRequest(app, { bookName: "книга", source: "urait" }, 2)).status, 502);
  delete process.env.EBS_URAIT_PARTNER_ID;
  process.env.EBS_URAIT_API_KEY = "fixture-key-without-partner";
  assert.equal((await searchRequest(app, { bookName: "книга", source: "urait" }, 2)).status, 502);
  assert.equal(upstream.mock.callCount(), 0, "авторизация, allowlist и ключи проверяются до сети");
  for (const role of [1, 2, 3]) {
    for (const source of [undefined, "megapro"]) {
      const response = await searchRequest(app, { bookName: "книга", source }, role);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { books: [{ id: "Прежняя книга", title: "", author: null, year: null, url: null, thumb: null, biblio: "Прежняя книга" }], truncated: false });
    }
  }
  process.env.EBS_LAN_TOKEN = "fixture-http-lan";
  process.env.EBS_URAIT_PARTNER_ID = "fixture-http-partner";
  process.env.EBS_URAIT_API_KEY = "fixture-http-api-key";
  upstream.mock.restore();
  t.mock.method(axios, "get", async (url: string) => ({ data: url.startsWith("https://openapi.e.lanbook.com/")
    ? { status: 200, count: 1, data: [lanBook(1)] }
    : { status: "success", total: 1, contents: [uraitBook] } }));
  for (const source of ["lan", "urait"]) {
    const response = await searchRequest(app, { bookName: "Ёлка", source }, 2);
    assert.equal(response.status, 200);
    assert.equal((response.body as { books: Book[] }).books[0].id, source === "lan" ? "lan:1" : `urait:${uraitBook.content_id}`);
  }
});
