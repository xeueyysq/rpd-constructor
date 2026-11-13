import type { DisciplineJson } from "../../types/discipline.ts";
import type { ValidationIssue } from "../../types/validation.ts";
import { normalizeLine } from "../docx/normalize-text.ts";

function normalizeForSearch(s: string): string {
  return normalizeLine(s).toLowerCase().replace(/\s+/g, " ");
}

const WATCH_FIELDS: (keyof DisciplineJson)[] = [
  "disciplins_name",
  "teacher",
  "competencies",
  "content",
  "goals",
];
const CONF_WARN = 0.4;

export type SemanticValidationContext = {
  /** Таблица «№ / Содержание раздела» распознана парсером. */
  hasSectionDescriptionTable?: boolean;
};

/**
 * Семантические предупреждения по смыслу JSON (док. «semantic validation»).
 */
export function runSemanticValidation(
  json: DisciplineJson,
  confidence: Record<string, number>,
  ctx?: SemanticValidationContext,
): ValidationIssue[] {
  const out: ValidationIssue[] = [];

  if (
    ctx?.hasSectionDescriptionTable &&
    !json.content_template_more_text?.trim()
  ) {
    out.push({
      code: "CONTENT_TEMPLATE_MISSING",
      severity: "warning",
      field: "content_template_more_text",
      message:
        "В документе найдена таблица содержания разделов, но content_template_more_text не заполнен",
    });
  }

  if (
    json.content_more_text &&
    normalizeForSearch(json.content_more_text).startsWith("содержание дисциплины")
  ) {
    out.push({
      code: "CONTENT_MORE_TEXT_TOO_BROAD",
      severity: "warning",
      field: "content_more_text",
      message:
        "content_more_text начинается с заголовка содержания и, вероятно, захватывает лишний блок",
    });
  }

  if (json.department && /\d{5,}\s*$/.test(json.department)) {
    out.push({
      code: "DEPARTMENT_JUNK",
      severity: "error",
      field: "department",
      message: "Кафедра содержит технический числовой хвост",
    });
  }

  if (json.competencies) {
    for (const [code, competency] of Object.entries(json.competencies)) {
      if (!competency.indicators?.length) {
        out.push({
          code: "COMP_INDICATORS",
          severity: "error",
          field: `competencies.${code}.indicators`,
          message: "Компетенция найдена, но индикаторы не распознаны",
        });
      } else if (
        competency.indicators.some((ind) => ind.code === null && ind.text?.trim())
      ) {
        out.push({
          code: "COMP_INDICATOR_NULL_CODE",
          severity: "warning",
          field: `competencies.${code}.indicators`,
          message: "Есть индикатор без кода (только текст) — проверьте таблицу",
        });
      }
      if (competency.name?.match(/\b(УК|ОПК|ПК|ПКО|ПКС)-\d+\.\d+\b/)) {
        out.push({
          code: "COMP_NAME_CODE",
          severity: "error",
          field: `competencies.${code}.name`,
          message: "В название компетенции попал код индикатора",
        });
      }
      if (!competency.results?.can?.length) {
        out.push({
          code: "COMP_CAN",
          severity: "warning",
          field: `competencies.${code}.results.can`,
          message: "Не распознано поле Уметь",
        });
      }
      if (!competency.results?.own?.length) {
        out.push({
          code: "COMP_OWN",
          severity: "warning",
          field: `competencies.${code}.results.own`,
          message: "Не распознано поле Владеть",
        });
      }
    }
  }

  const invalidContentTitles = [
    "Наименование разделов и тем дисциплины (модуля)",
    "Итого за семестр",
  ];
  if (json.content) {
    for (const item of Object.values(json.content)) {
      if (invalidContentTitles.includes(item.title)) {
        out.push({
          code: "CONTENT_NOISE",
          severity: "error",
          field: "content",
          message: `В content попала служебная строка: ${item.title}`,
        });
      } else if (
        /наименование\s+разделов/i.test(item.title) &&
        /дисциплин/i.test(item.title)
      ) {
        out.push({
          code: "CONTENT_NOISE",
          severity: "error",
          field: "content",
          message: `В content попала служебная строка заголовка таблицы: ${item.title}`,
        });
      }
      if (/^Раздел\s+\d+$/i.test(item.title) && item.total_hours != null && item.total_hours <= 10) {
        out.push({
          code: "SECTION_AS_HOURS",
          severity: "warning",
          field: "content",
          message: "Похоже, номер раздела ошибочно распознан как часы (проверьте total_hours).",
        });
      }
      if (
        item.title === "Подготовка к промежуточной аттестации" &&
        (item.lectures != null || item.practice != null || item.labs != null)
      ) {
        out.push({
          code: "CONTENT_ATTEST_MIX",
          severity: "error",
          field: "content",
          message:
            "Для подготовки к аттестации ошибочно заполнены лекции/практика/лабораторные",
        });
      }
      if (
        item.labs != null &&
        item.total_hours != null &&
        item.independent_work != null &&
        item.labs === item.total_hours - item.independent_work
      ) {
        out.push({
          code: "CONTENT_LABS_CONTACT",
          severity: "warning",
          field: "content.labs",
          message:
            "Значение labs похоже на общий объём контактной работы, а не на лабораторные занятия",
        });
      }
    }
  }

  if (json.additional_textbook?.some((x) => /Профессиональные базы данных|Электронно-библиотечные системы/i.test(x))) {
    out.push({
      code: "RES_MIXED",
      severity: "error",
      field: "additional_textbook",
      message: "В дополнительную литературу попали профессиональные ресурсы",
    });
  }
  if (json.professional_information_resources?.some((x) => /^Ресурсное обеспечение$/i.test(x.trim()))) {
    out.push({
      code: "RES_HEADING",
      severity: "error",
      field: "professional_information_resources",
      message: "В professional_information_resources попал заголовок раздела",
    });
  }
  if (
    json.professional_information_resources?.some(
      (x) => normalizeForSearch(x) === "и базы данных",
    )
  ) {
    out.push({
      code: "RES_GARBAGE",
      severity: "error",
      field: "professional_information_resources",
      message: "В профессиональные ресурсы попал обрывок заголовка",
    });
  }
  if (
    json.professional_information_resources?.some((x) =>
      /3БД.*4http|4http.*5Web|5Web.*6Национальная/i.test(x),
    )
  ) {
    out.push({
      code: "RES_GLUED",
      severity: "error",
      field: "professional_information_resources",
      message: "Несколько профессиональных ресурсов склеены в одну строку",
    });
  }

  for (const key of WATCH_FIELDS) {
    const v = json[key];
    const c = confidence[key as string] ?? 0;
    const isEmpty =
      v == null ||
      (typeof v === "string" && !v.trim()) ||
      (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) ||
      (Array.isArray(v) && v.length === 0);
    if (isEmpty && key === "disciplins_name") {
      out.push({
        code: "FIELD_MISSING",
        severity: "error",
        field: "disciplins_name",
        message: "Название дисциплины не извлечено.",
        suggestion: "Проверьте титул по фразе «Рабочая программа дисциплины».",
      });
      continue;
    }
    if (!isEmpty && c < CONF_WARN) {
      out.push({
        code: "LOW_CONFIDENCE",
        severity: "warning",
        field: String(key),
        message: `Поле «${key}»: низкая уверенность (${(c * 100).toFixed(0)}%).`,
        suggestion: "Сверьте с исходным DOCX.",
      });
    }
  }
  return out;
}
