import type { TemplateData } from "../types";

const DEFAULT_STATUS_PRIORITY: Record<string, number> = { unloaded: 1 };

export function sortTemplatesByStatus(
  templates: TemplateData[],
  statusPriority: Record<string, number> = DEFAULT_STATUS_PRIORITY
): TemplateData[] {
  return [...templates].sort(
    (a, b) => (statusPriority[a.status] ?? 0) - (statusPriority[b.status] ?? 0)
  );
}
