export function normalizeText(input: string): string {
  return input
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([а-яА-ЯёЁa-zA-Z])-\n([а-яА-ЯёЁa-zA-Z])/g, "$1$2")
    .replace(/[–—]/g, "–")
    .trim();
}

export function normalizeLine(input: string): string {
  return normalizeText(input).replace(/\s+/g, " ").trim();
}

/** Убирает числовой «хвост» и мусор после названия кафедры. */
export function cleanDepartment(input: string | null): string | null {
  if (!input) {
    return null;
  }
  let value = input
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  value = value.replace(/\s*\d{5,}\s*$/g, "");
  value = value.replace(/\s+(Рабочая программа|Направление подготовки|Профиль).*$/i, "");
  return value.trim() || null;
}
