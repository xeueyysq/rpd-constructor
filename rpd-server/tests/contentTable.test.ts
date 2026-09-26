import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildContentTableHtml } from "../app/pdf-generator/page-generator.ts";

function dataRows(html: string) {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)]
      .map((cell) => cell[1].replace(/<[^>]*>/g, "").trim()))
    .filter((cells) => cells.length > 0);
}

describe("Таблица содержания дисциплины", () => {
  const content = {
    first: { theme: "Тема 1", lectures: 68, seminars: 68, control: 27, independent_work: 89 },
    __attestation__: { theme: "Аттестация", control: "17,5" },
  };

  for (const forWord of [false, true]) {
    test(`${forWord ? "Word" : "PDF"}: семь ячеек и формула для тем, аттестации и итога`, () => {
      const rows = dataRows(buildContentTableHtml(content, { forWord }));
      assert.deepEqual(rows, [
        ["Тема 1", "252", "68", "68", "136", "89", "27"],
        ["Аттестация", "17,5", "0", "0", "0", "0", "17,5"],
        ["Итого за семестр / курс", "269,5", "68", "68", "136", "89", "44,5"],
      ]);
    });
  }

  test("PDF: СРС и Контроль объединены по вертикали", () => {
    const html = buildContentTableHtml(content);
    assert.match(html, /colspan="5">в том числе:/);
    assert.match(html, /rowspan="2">Самостоятельная работа обучающегося/);
    assert.match(html, /rowspan="2">Контроль/);
  });

  test("Word: после объединения по горизонтали нет rowspan, внизу два заполнителя", () => {
    const html = buildContentTableHtml(content, { forWord: true });
    const headerRows = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(0, 3).map((match) => match[1]);
    assert.match(headerRows[1], /Самостоятельная работа обучающегося/);
    assert.match(headerRows[1], /Контроль/);
    assert.doesNotMatch(headerRows[1], /rowspan/);
    assert.equal((headerRows[2].match(/<th[^>]*><\/th>/g) || []).length, 2);
  });
});
