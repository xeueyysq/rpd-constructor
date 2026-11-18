// Общий контракт предпросмотра, полевого, полного и пакетного импорта.
// protocol встречался в legacy-схемах; копируется только при наличии колонки.
export const TEMPLATE_IMPORT_FIELDS = [
  "protocol", "goals", "place_more_text", "content", "content_more_text",
  "content_template_more_text", "methodological_support_template", "textbook",
  "additional_textbook", "professional_information_resources", "software", "logistics_template",
] as const;
export type TemplateImportField = typeof TEMPLATE_IMPORT_FIELDS[number];
export type TemplateImportMode = "append" | "replace";
export type TemplateImportValues = Partial<Record<TemplateImportField, unknown>>;

export function isTemplateImportField(value: unknown): value is TemplateImportField {
  return typeof value === "string" && (TEMPLATE_IMPORT_FIELDS as readonly string[]).includes(value);
}

type MatchRow = { discipline: string | null; semester: number | null; record_type: string | null };

export function importMatchKey(row: MatchRow): string {
  return JSON.stringify([row.discipline?.trim().replace(/\s+/g, " ").toLowerCase() ?? "", row.semester, row.record_type]);
}

// Сначала резервируем все точные связи, включая неоднозначные и недоступные
// для записи. Только оставшиеся строки могут участвовать в переносе семестра.
export function matchTemplateImports<T extends MatchRow>(sources: T[], targets: MatchRow[]): Array<{ source?: T; reason?: "missing_source" | "ambiguous" }> {
  const group = <R extends MatchRow>(rows: R[], key: (row: MatchRow) => string) => {
    const groups = new Map<string, R[]>();
    for (const row of rows) {
      const name = key(row);
      const entries = groups.get(name) ?? [];
      entries.push(row);
      groups.set(name, entries);
    }
    return groups;
  };
  const exactSources = group(sources, importMatchKey);
  const exactTargets = group(targets, importMatchKey);
  const remainingSources = sources.filter((row) => !exactTargets.has(importMatchKey(row)));
  const remainingTargets = targets.filter((row) => !exactSources.has(importMatchKey(row)));
  const disciplineKey = (row: MatchRow) => importMatchKey({ ...row, semester: null });
  const fallbackSources = group(remainingSources, disciplineKey);
  const fallbackTargets = group(remainingTargets, disciplineKey);
  return targets.map((target) => {
    if (!target.discipline?.trim()) return { reason: "missing_source" };
    const key = importMatchKey(target);
    const exact = exactSources.get(key);
    if (exact) return exact.length === 1 && exactTargets.get(key)!.length === 1
      ? { source: exact[0] } : { reason: "ambiguous" };
    const candidates = fallbackSources.get(disciplineKey(target)) ?? [];
    if (target.semester === null || !candidates.some((row) => row.semester !== null && row.semester !== target.semester))
      return { reason: "missing_source" };
    if (candidates.length !== 1 || fallbackTargets.get(disciplineKey(target))!.length !== 1)
      return { reason: "ambiguous" };
    return { source: candidates[0] };
  });
}
