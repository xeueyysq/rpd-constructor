import type { DisciplineJson } from "../../types/discipline.ts";
import type { ValidationIssue } from "../../types/validation.ts";

/**
 * Кросс-поле: согласованность без «выдумывания» значений.
 */
export function runCrossFieldValidation(json: DisciplineJson): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (json.zet != null && json.zet < 0) {
    out.push({
      code: "CROSS_ZET",
      severity: "warning",
      field: "zet",
      message: "Некорректное количество зачётных единиц.",
    });
  }
  if (json.year != null && (json.year < 1990 || json.year > 2100)) {
    out.push({
      code: "CROSS_YEAR",
      severity: "warning",
      field: "year",
      message: "Год вне ожидаемого диапазона, проверьте титул.",
    });
  }
  const cKeys = Object.keys(json.content || {});
  if (json.zet && json.zet > 0 && cKeys.length === 0) {
    out.push({
      code: "CROSS_ZET_CONTENT",
      severity: "warning",
      message: "Указан объём (ЗЕТ), но структура «содержание» пуста.",
      details: "Возможно, таблица не распознана.",
    });
  }
  return out;
}
