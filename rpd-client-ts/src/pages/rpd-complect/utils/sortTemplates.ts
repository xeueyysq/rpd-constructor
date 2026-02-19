import type { TemplateData } from "../types";

const DEFAULT_STATUS_PRIORITY: Record<string, number> = {
  unloaded: 1,
};

export function sortTemplatesByStatus(
  templates: TemplateData[],
  statusPriority: Record<string, number> = DEFAULT_STATUS_PRIORITY
): TemplateData[] {
  return [...templates].sort((a, b) => {
    const priorityA = statusPriority[a.status?.status ?? ""] ?? 0;
    const priorityB = statusPriority[b.status?.status ?? ""] ?? 0;
    return priorityA - priorityB;
  });
}
