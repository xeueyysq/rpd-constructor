import type { ConvertResponse } from "../wordParser/types/parser.ts";
import type { DisciplineJson } from "../wordParser/types/discipline.ts";
import { TEMPLATE_IMPORT_FIELDS, type TemplateImportField } from "../templateImport.ts";
import { Unprocessable } from "../../utils/Errors.ts";

export type WordValues = Partial<Record<TemplateImportField, string | string[] | Record<string, WordContentRow>>>;
export type WordContentRow = { theme: string; total: number; lectures: number; seminars: number; contact: number; independent_work: number; control: null };

const TEXT_FIELDS = ["goals", "place_more_text", "content_more_text", "content_template_more_text",
  "methodological_support_template", "software"] as const;
const ARRAY_FIELDS = ["textbook", "additional_textbook"] as const;
const WORD_FIELDS = [...TEXT_FIELDS, ...ARRAY_FIELDS, "professional_information_resources", "content"] as const;
const MAX_TEXT = 30_000;
const MAX_ITEMS = 100;
const MAX_ROWS = 150;
const MAX_PREVIEW_VALUES_BYTES = 75 * 1024;
const LABELS: Record<string, string> = {
  goals: "Цели и задачи", place_more_text: "Дополнительный текст о месте дисциплины",
  content_more_text: "Дополнение к содержанию", content_template_more_text: "Описание содержания",
  methodological_support_template: "Методическое обеспечение", software: "Программное обеспечение",
  textbook: "Основная литература", additional_textbook: "Дополнительная литература",
};

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() && value.length <= MAX_TEXT ? value.trim() : undefined;
}

function contentRows(content: DisciplineJson["content"], warnings: string[]): Record<string, WordContentRow> | undefined {
  const entries = Object.entries(content);
  if (!entries.length || entries.length > MAX_ROWS) return undefined;
  const output: Record<string, WordContentRow> = {};
  for (const [key, row] of entries) {
    const title = textValue(row.title);
    if (!title || title.length > 500 || !/^\d{1,4}$/.test(key)) { warnings.push("Содержание: не удалось проверить названия или номера разделов; поле пропущено"); return undefined; }
    if (row.labs != null && row.labs !== 0) { warnings.push("Содержание: лабораторные часы нельзя перенести в таблицу РПД; поле пропущено"); return undefined; }
    const values = [row.total_hours, row.lectures, row.practice, row.independent_work];
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      warnings.push("Содержание: неполные или неоднозначные часы; поле пропущено"); return undefined;
    }
    const [total, lectures, seminars, independent_work] = values as number[];
    if (Math.abs(total - lectures - seminars - independent_work) > 0.01) {
      warnings.push("Содержание: сумма часов не совпадает с разделом; поле пропущено"); return undefined;
    }
    output[key] = { theme: title, total, lectures, seminars, contact: lectures + seminars, independent_work, control: null };
  }
  warnings.push("Содержание: контактные часы вычислены из лекций и практики; контроль и часы 1С сохраните по учебному плану");
  return output;
}

function hasFieldError(result: ConvertResponse, field: string): boolean {
  return result.validation.some((item) => (item.key === field || item.field === field) && item.status === "error")
    || (result.issues ?? []).some((item) => item.field === field && (item.severity === "error" || item.severity === "critical"));
}

export function adaptWordResult(result: ConvertResponse): { values: WordValues; warnings: string[]; source: { fileName: string; discipline: string | null; department: string | null; year: number | null } } {
  if (!result.ok || !result.json) throw new Unprocessable(result.errors[0] || "Не удалось прочитать рабочую программу DOCX");
  const json = result.json;
  const warnings = [...result.warnings, ...result.errors, ...(result.issues ?? []).filter((issue) => issue.severity !== "info").map((issue) => issue.message)];
  const values: WordValues = {};
  for (const field of TEXT_FIELDS) {
    const value = textValue(json[field]);
    if (value && !hasFieldError(result, field)) values[field] = value;
    else if (json[field] != null) warnings.push(`${LABELS[field]}: значение не перенесено из-за ошибки разбора или размера`);
  }
  for (const field of ARRAY_FIELDS) {
    const raw = json[field];
    if (Array.isArray(raw) && raw.length && raw.length <= MAX_ITEMS && raw.every((item) => textValue(item))
      && raw.join("").length <= MAX_TEXT && !hasFieldError(result, field))
      values[field] = raw.map((item) => item.trim());
    else if (raw != null) warnings.push(`${LABELS[field]}: список не перенесён из-за ошибки разбора или размера`);
  }
  const resources = json.professional_information_resources;
  if (Array.isArray(resources) && resources.length && resources.length <= MAX_ITEMS && resources.every((item) => textValue(item))
    && resources.join("\n").length <= MAX_TEXT && !hasFieldError(result, "professional_information_resources"))
    values.professional_information_resources = resources.join("\n");
  else if (resources != null) warnings.push("Профессиональные ресурсы: список не перенесён");
  if (!hasFieldError(result, "content")) {
    const content = contentRows(json.content, warnings);
    if (content) values.content = content;
  } else warnings.push("Содержание: ошибка разбора, поле пропущено");
  while (Buffer.byteLength(JSON.stringify(values)) > MAX_PREVIEW_VALUES_BYTES) {
    const largest = Object.keys(values).sort((a, b) => JSON.stringify(values[b as TemplateImportField]).length - JSON.stringify(values[a as TemplateImportField]).length)[0] as TemplateImportField;
    delete values[largest];
    warnings.push(`Большой раздел ${LABELS[largest] ?? largest} пропущен из предпросмотра`);
  }
  if (!Object.keys(values).length) throw new Unprocessable("В DOCX не найдены совместимые разделы рабочей программы");
  warnings.push("Компетенции, ФОС, сведения о комплекте, преподавателях и нагрузка 1С не импортируются из Word");
  return { values, warnings: [...new Set(warnings.map((item) => item.slice(0, 500)))].slice(0, 50),
    source: { fileName: result.fileName, discipline: json.disciplins_name, department: json.department, year: json.year } };
}

function safeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\r\n?|\n/g, "<br/>");
}

export function validateWordApply(selectedFields: unknown, rawValues: unknown): { fields: TemplateImportField[]; values: WordValues } {
  if (!Array.isArray(selectedFields) || !selectedFields.length || selectedFields.length > WORD_FIELDS.length
    || selectedFields.some((field) => typeof field !== "string" || !(WORD_FIELDS as readonly string[]).includes(field))
    || new Set(selectedFields).size !== selectedFields.length) throw new Unprocessable("Выберите допустимые поля импорта");
  if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) throw new Unprocessable("Укажите значения полей импорта");
  const input = rawValues as Record<string, unknown>;
  if (Object.keys(input).some((key) => !(TEMPLATE_IMPORT_FIELDS as readonly string[]).includes(key) || !selectedFields.includes(key)))
    throw new Unprocessable("Переданы лишние или защищённые поля");
  const values: WordValues = {};
  for (const field of selectedFields as TemplateImportField[]) {
    const raw = input[field];
    if (field === "content") {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Unprocessable("Некорректное содержание");
      const entries = Object.entries(raw);
      if (!entries.length || entries.length > MAX_ROWS) throw new Unprocessable("Некорректное содержание");
      const rows: Record<string, WordContentRow> = {};
      for (const [key, value] of entries) {
        if (!/^\d{1,4}$/.test(key) || !value || typeof value !== "object" || Array.isArray(value)) throw new Unprocessable("Некорректная строка содержания");
        const row = value as Record<string, unknown>;
        if (Object.keys(row).some((name) => !["theme", "total", "lectures", "seminars", "contact", "independent_work", "control"].includes(name))
          || !textValue(row.theme) || row.control !== null
          || ["total", "lectures", "seminars", "contact", "independent_work"].some((name) => typeof row[name] !== "number" || !Number.isFinite(row[name]) || (row[name] as number) < 0)
          || Math.abs((row.total as number) - (row.lectures as number) - (row.seminars as number) - (row.independent_work as number)) > 0.01
          || Math.abs((row.contact as number) - (row.lectures as number) - (row.seminars as number)) > 0.01)
          throw new Unprocessable("Некорректные часы содержания");
        rows[key] = { theme: safeHtml(String(row.theme).trim()), total: row.total as number, lectures: row.lectures as number,
          seminars: row.seminars as number, contact: row.contact as number, independent_work: row.independent_work as number, control: null };
      }
      values.content = rows;
    } else if ((ARRAY_FIELDS as readonly string[]).includes(field)) {
      if (!Array.isArray(raw) || !raw.length || raw.length > MAX_ITEMS || raw.some((item) => !textValue(item))) throw new Unprocessable("Некорректный список литературы");
      values[field] = raw.map((item: string) => item.trim());
    } else {
      const value = textValue(raw);
      if (!value) throw new Unprocessable("Пустое или слишком длинное поле импорта");
      values[field] = safeHtml(value);
    }
  }
  return { fields: selectedFields as TemplateImportField[], values };
}
