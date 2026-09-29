import test from "node:test";
import assert from "node:assert/strict";
import {
  biblioText,
  normalizeBook,
  parseBookName,
  rankBooks,
  searchBooks,
  type Book,
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
