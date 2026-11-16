import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { inspectDocx, MAX_DOCX_BYTES } from "../app/modules/wordImport/inspectDocx.ts";
import { parseWord } from "../app/modules/wordImport/parseWord.ts";
import { adaptWordResult, validateWordApply } from "../app/modules/wordImport/wordAdapter.ts";
import type { ConvertResponse } from "../app/modules/wordParser/types/parser.ts";
import generateWord from "../app/pdf-generator/word-generator.ts";
import { pool } from "../config/db.ts";
import { wordHoursDocument } from "./helpers/wordHoursDocument.ts";

const fixture = new URL("./fixtures/avs-programma-ivt-trpo-2024.docx", import.meta.url);
const syntheticPg = process.env.DB_HOST === "127.0.0.1" && process.env.DB_PORT === "5433"
  && process.env.DB_NAME === "rpd_e2e" && process.env.DB_USER === "rpd_e2e"
  && process.env.DB_PASSWORD === "rpd_e2e";

async function archive(documentXml: string, extras: Record<string, string> = {}) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships><Relationship Type="officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", documentXml);
  for (const [name, value] of Object.entries(extras)) zip.file(name, value);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

test("предоставленная РПД проходит потоковую проверку и даёт выборочные совместимые поля", async () => {
  const bytes = readFileSync(fixture);
  await inspectDocx(bytes);
  const preview = await parseWord(bytes, "avs-programma-ivt-trpo-2024.docx");
  assert.equal(preview.source.discipline, "Архитектура вычислительных систем");
  assert.equal(preview.source.year, 2024);
  assert.match(String(preview.values.goals), /архитектуре современных/i);
  assert.ok(Array.isArray(preview.values.textbook) && preview.values.textbook.length >= 2);
  assert.match(String(preview.values.professional_information_resources), /Электронно-библиотечная система/);
  assert.equal(preview.values.content, undefined, "неполные часы нельзя угадывать");
  assert.ok(preview.warnings.some((warning) => warning.includes("неполные") || warning.includes("неоднозначные")));
  for (const protectedField of ["competencies", "assessment_tools_template", "faculty", "direction", "year", "study_load"])
    assert.equal(protectedField in preview.values, false, protectedField);
});

test("DOCX собственного генератора даёт цели и литературу для Word-предпросмотра", { skip: !syntheticPg, timeout: 30_000 }, async (t) => {
  t.after(() => pool.end());
  const generated = await generateWord(300); // только чтение синтетической РПД из e2e/seed.sql
  await inspectDocx(generated);
  const preview = await parseWord(generated, "generated.docx");
  assert.ok(preview.values.goals && String(preview.values.goals).length > 20);
  assert.ok(Array.isArray(preview.values.textbook) && preview.values.textbook.length > 0);
  assert.ok(Array.isArray(preview.values.additional_textbook) && preview.values.additional_textbook.length > 0);
  for (const field of ["competencies", "assessment_tools_template", "study_load", "disciplins_name"])
    assert.equal(field in preview.values, false, field);
  assert.deepEqual(preview.values.content, { "1": { theme: "Тема источника", total: 24, lectures: 9,
    seminars: 7, contact: 16, independent_work: 8, control: null } }, "часы собственного DOCX распознаются по шапке, нагрузка 1С остаётся защищённой");
});

test("повреждённый, неподходящий, опасный и чрезмерно распакованный DOCX отвергаются", async () => {
  await assert.rejects(inspectDocx(Buffer.from("text")), { status: 422 });
  await assert.rejects(inspectDocx(Buffer.alloc(MAX_DOCX_BYTES + 1)), { status: 413 });
  await assert.rejects(inspectDocx(await archive("<w:document/>", { "../escape.xml": "x" })), { status: 422 });
  await assert.rejects(inspectDocx(await archive("<!DOCTYPE a [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><w:document/>")), { status: 422 });
  await assert.rejects(inspectDocx(await archive("<w:document>" + "x".repeat(9 * 1024 * 1024) + "</w:document>")), { status: 413 });
  const nonRpd = await archive('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Обычное письмо</w:t></w:r></w:p></w:body></w:document>');
  await inspectDocx(nonRpd);
  await assert.rejects(parseWord(nonRpd, "letter.docx"), { status: 422 });
});

test("ошибка отдельного поля не очищает цель, apply принимает только выбранные безопасные значения", () => {
  const parsed: ConvertResponse = { ok: true, fileName: "rpd.docx", sections: null, confidence: {}, warnings: [], errors: [],
    validation: [{ field: "goals", key: "goals", status: "error", value: "", message: "Не найдено", confidence: 0, source: "missing" }],
    json: { disciplins_name: "Тест", department: null, teacher: null, goals: "ошибочное значение", place: null, semester: null,
      certification: null, place_more_text: null, competencies: {}, zet: null, content: {}, content_more_text: null,
      content_template_more_text: null, methodological_support_template: null, assessment_tools_template: null,
      textbook: ["Книга"], additional_textbook: null, professional_information_resources: null, software: null,
      faculty: null, direction: null, profile: null, education_level: null, education_form: null, year: null } };
  const preview = adaptWordResult(parsed);
  assert.equal(preview.values.goals, undefined);
  assert.deepEqual(preview.values.textbook, ["Книга"]);
  parsed.json!.content = { "1": { title: "Раздел", total_hours: 8, lectures: 2, practice: 2, independent_work: 4, labs: null } };
  assert.deepEqual(adaptWordResult(parsed).values.content, { "1": { theme: "Раздел", total: 8, lectures: 2,
    seminars: 2, contact: 4, independent_work: 4, control: null } });
  parsed.json!.content["1"].labs = 2;
  assert.equal(adaptWordResult(parsed).values.content, undefined, "лабораторные часы не переносятся в контроль");
  assert.deepEqual(validateWordApply(["goals"], { goals: "<img src=x onerror=alert(1)>" }).values,
    { goals: "&lt;img src=x onerror=alert(1)&gt;" });
  assert.throws(() => validateWordApply(["competencies"], { competencies: {} }), { status: 422 });
  assert.throws(() => validateWordApply(["goals"], { goals: "Текст", assessment_tools_template: "ФОС" }), { status: 422 });
  assert.throws(() => validateWordApply(["goals"], { goals: "" }), { status: 422 });
});

for (const numbered of [true, false]) {
  test(`Word: сокращённая многострочная шапка ${numbered ? "с номерами" : "без номеров"} сохраняет все темы и исходные часы`, async () => {
    const preview = await parseWord(await wordHoursDocument(numbered), "hours.docx");
    const content = preview.values.content;
    assert.ok(content && typeof content === "object" && !Array.isArray(content));
    assert.equal(Object.keys(content).length, 10, "шапка и итоги не становятся темами, короткие названия и практические темы не теряются");
    assert.deepEqual(content["1"], { theme: "Тема 1", total: 15, lectures: 2, seminars: 4,
      contact: 6, independent_work: 3, control: null });
    assert.equal(content["9"].theme, "Практические аспекты обучения: оценка ошибки");
    assert.equal(content["10"].total, 17);
    assert.equal(Object.values(content).reduce((sum, item) => sum + item.total, 0), 144);
    assert.ok(preview.warnings.some((warning) => /Содержание:.*расхождение.*10/.test(warning) && /15/.test(warning) && /9/.test(warning)),
      "расхождение часов показано до импорта, без автоматического пересчёта исходника");
    assert.deepEqual(validateWordApply(["content"], { content }).values.content, content);
  });
}
