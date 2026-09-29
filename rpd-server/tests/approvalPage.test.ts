import test from "node:test";
import assert from "node:assert/strict";
import { renderTeacherBlocks } from "../app/pdf-generator/page-generator.ts";

test("лист согласования показывает пустой, один и два блока", () => {
  const empty = renderTeacherBlocks([], "text-align:center");
  assert.equal(empty.match(/подпись<\/i>/g)?.length, 1);
  const one = renderTeacherBlocks([{ fullname: "Петров Пётр Петрович" }], "text-align:center");
  assert.match(one, /Петров П\.П\./);
  assert.equal(one.match(/подпись<\/i>/g)?.length, 1);
  const two = renderTeacherBlocks([{ fullname: "Петров Пётр Петрович" }, { fullname: "Сидорова Анна Ивановна" }], "text-align:center");
  assert.match(two, /Петров П\.П\.[\s\S]*Сидорова А\.И\./);
  assert.equal(two.match(/подпись<\/i>/g)?.length, 2);
});

test("ФИО экранируется для PDF и Word", () => {
  const html = renderTeacherBlocks([{ fullname: "<script> Анна Ивановна" }], "");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
