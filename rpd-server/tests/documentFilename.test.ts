import assert from "node:assert/strict";
import { validateHeaderValue } from "node:http";
import { test } from "node:test";
import { documentContentDisposition } from "../app/utils/documentFilename.ts";

function decodedName(header: string): string {
  const value = header.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  assert.ok(value);
  return decodeURIComponent(value);
}

test("PDF и DOCX получают основу дисциплина_направление_год набора", () => {
  const metadata = { disciplins_name: "Программирование", direction: "09.03.01 Информатика и вычислительная техника", year: 2026 };
  const pdf = documentContentDisposition(metadata, "pdf");
  const docx = documentContentDisposition(metadata, "docx");
  assert.equal(decodedName(pdf), "Программирование_09.03.01 Информатика и вычислительная техника_2026.pdf");
  assert.equal(decodedName(docx), "Программирование_09.03.01 Информатика и вычислительная техника_2026.docx");
  validateHeaderValue("Content-Disposition", pdf);
  validateHeaderValue("Content-Disposition", docx);
  assert.match(pdf, /filename="rpd_2026\.pdf"/);
});

test("опасные символы удаляются, а длинное кириллическое имя ограничено по UTF-8", () => {
  const header = documentContentDisposition({
    disciplins_name: `  ../${"Физика".repeat(100)}\u0000\n`,
    direction: `01.03.02\\${"Направление".repeat(100)}?`,
    year: 2027,
  }, "docx");
  const filename = decodedName(header);
  assert.ok(Buffer.byteLength(filename, "utf8") <= 180);
  assert.match(filename, /_2027\.docx$/);
  assert.doesNotMatch(filename, /[\\/?]/u);
  assert.ok(!filename.includes(String.fromCharCode(0)) && !filename.includes("\n"));
  validateHeaderValue("Content-Disposition", header);
});
