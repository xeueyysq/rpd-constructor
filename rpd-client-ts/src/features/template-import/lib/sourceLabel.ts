import {
  getTemplateStatusLabel,
  importComplectLabel,
  type ImportCatalogSummary,
  type ImportCatalogTemplate,
} from "@entities/template";

export function sourceLabel(row: ImportCatalogSummary | ImportCatalogTemplate) {
  const source = "complect" in row ? row.complect : row;
  const program = [source.faculty, importComplectLabel(source)]
    .filter(Boolean)
    .join(" • ");
  return "complect" in row
    ? [
        row.disciplins_name ?? "—",
        "семестр " + (row.semester ?? "—"),
        recordTypeLabel(row.record_type),
        getTemplateStatusLabel(row.status),
        program,
      ].join(" • ")
    : program;
}

export function recordTypeLabel(type: string | null) {
  if (type === "discipline") return "Дисциплина";
  if (type === "practice") return "Практика";
  return type || "—";
}
