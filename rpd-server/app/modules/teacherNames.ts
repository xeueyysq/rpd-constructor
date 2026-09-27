export type NameUser = { id: number; fullname: unknown };

export function normalizeName(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\./g, " ").replace(/\s+/g, " ").trim();
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
  return names.map((name) => {
    const wanted = nameParts(name);
    const matches = users.filter((user) => {
      const actual = nameParts(user.fullname);
      return wanted.length >= 2 && actual.length >= wanted.length && wanted.every((part, index) =>
        index === 0 ? actual[index] === part : part.length === 1 ? actual[index]?.startsWith(part) : actual[index] === part);
    });
    return { name, userId: matches.length === 1 ? matches[0].id : null, ambiguous: matches.length > 1 };
  });
}
