// Общий контракт предпросмотра, полевого, полного и пакетного импорта.
// protocol встречался в legacy-схемах; копируется только при наличии колонки.
export const TEMPLATE_IMPORT_FIELDS = [
  "protocol", "goals", "place_more_text", "content", "content_more_text",
  "content_template_more_text", "methodological_support_template", "textbook",
  "additional_textbook", "professional_information_resources", "software", "logistics_template",
] as const;
export type TemplateImportField = typeof TEMPLATE_IMPORT_FIELDS[number];

export function isTemplateImportField(value: unknown): value is TemplateImportField {
  return typeof value === "string" && (TEMPLATE_IMPORT_FIELDS as readonly string[]).includes(value);
}

export function importMatchKey(row: { discipline: string | null; semester: number | null; record_type: string | null }): string {
  return JSON.stringify([row.discipline?.trim().replace(/\s+/g, " ").toLowerCase() ?? "", row.semester, row.record_type]);
}
