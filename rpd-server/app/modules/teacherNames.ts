export type NameUser = { id: number; fullname: unknown };

const serviceLabels = new Set(["нет данных", "не назначен", "не указан", "не определен", "нет преподавателя", "без преподавателя"]);

export function normalizeName(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

// 1С отдаёт ФИО, а не идентификатор человека. Снимаем только подтверждённые
// пометки занятости; остальные слова/скобки не интерпретируем как часть личности.
export function canonicalTeacherLabel(value: string): string | null {
  const label = value.trim().replace(/\s*\((?:внеш|вн)\.совм\.\)$/iu, "").replace(/\s+/g, " ").trim();
  return !label || /^вакансия/iu.test(label) || serviceLabels.has(normalizeName(label)) ? null : label;
}

export function teacherPerson(value: string) {
  const label = canonicalTeacherLabel(value);
  if (!label) return null;
  const parts = label.split(" ");
  // Два полных имени допустимы: отсутствующее отчество остаётся пустым.
  // Инициалы и служебные строки не дают оснований создавать человека.
  if (![2, 3].includes(parts.length) || parts.some((part) =>
    !/^[\p{L}][\p{L}'’-]*[\p{L}]$/u.test(part))) return null;
  return { label, key: normalizeName(label), fullname: {
    surname: parts[0], name: parts[1], patronymic: parts[2] ?? "",
  } };
}

function nameParts(value: unknown): string[] {
  if (typeof value === "string") return normalizeName(value).split(" ").filter(Boolean);
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const fields = value as Record<string, unknown>;
  return [fields.surname, fields.name, fields.patronymic]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .map(normalizeName);
}

export function fullnameText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const fields = value as Record<string, unknown>;
  return [fields.surname, fields.name, fields.patronymic]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ");
}

export function formatShortName(fullname: unknown): string {
  const source = typeof fullname === "string" ? fullname : fullnameText(fullname);
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts.slice(1).map((part) => `${part[0].toLocaleUpperCase("ru-RU")}.`).join("")}` : (parts[0] ?? "");
}

export function splitNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.flatMap((item) => typeof item === "string" ? item.split(",") : [])
    .map((name) => name.trim()).filter(Boolean))];
}

export function matchTeacherNames(names: string[], users: NameUser[]): { name: string; userId: number | null; ambiguous: boolean }[] {
  const labels = new Map<string, string>();
  for (const source of names) {
    const label = canonicalTeacherLabel(source);
    if (label && !labels.has(normalizeName(label))) labels.set(normalizeName(label), label);
  }
  return [...labels.values()].map((name) => {
    const wanted = nameParts(name);
    const matches = users.filter((user) => {
      const actual = nameParts(user.fullname);
      return wanted.length >= 2 && actual.length >= wanted.length && wanted.every((part, index) =>
        index === 0 ? actual[index] === part : part.length === 1 ? actual[index]?.startsWith(part) : actual[index] === part);
    });
    return { name, userId: matches.length === 1 ? matches[0].id : null, ambiguous: matches.length > 1 };
  });
}
