import type { TemplateImportField, TemplateImportMode, TemplateImportValues } from "./templateImport.ts";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sourceContentRows(incoming: unknown): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  if (record(incoming) || Array.isArray(incoming)) {
    for (const [key, value] of Object.entries(incoming)) {
      if (key !== "__attestation__" && record(value)
        && ["theme", "total", "lectures", "seminars", "contact", "independent_work", "control"].some((name) => Object.hasOwn(value, name))) rows.push(value);
    }
  }
  return rows;
}

// Имена ключей legacy-строк произвольны. Строку определяет её содержимое,
// а не числовой ключ; неизвестные технические данные источника не переносим.
export function mergeContentRows(previous: unknown, incoming: unknown, mode: TemplateImportMode): Record<string, unknown> {
  const existing: Record<string, unknown> = record(previous) ? previous : Array.isArray(previous) ? Object.fromEntries(Object.entries(previous)) : {};
  const result: Record<string, unknown> = mode === "append" ? { ...existing } : {};
  let next = 1n;
  for (const key of Object.keys(result)) if (/^\d+$/.test(key) && BigInt(key) >= next) next = BigInt(key) + 1n;
  for (const value of sourceContentRows(incoming)) result[String(next++)] = value;
  if (Object.hasOwn(existing, "__attestation__")) result.__attestation__ = existing.__attestation__;
  return result;
}

export function appendTemplateValues(target: TemplateImportValues, source: TemplateImportValues, fields: TemplateImportField[]): TemplateImportValues {
  const merged: TemplateImportValues = {};
  for (const field of fields) {
    const incoming = source[field];
    const previous = target[field];
    if (incoming == null || (typeof incoming === "string" && !incoming.trim()) || (Array.isArray(incoming) && !incoming.length)) {
      merged[field] = previous;
    } else if (field === "content") {
      const rows = sourceContentRows(incoming);
      merged[field] = !rows.length ? previous
        : Array.isArray(previous) ? [...previous, ...rows]
        : previous == null && Array.isArray(incoming) ? rows
        : mergeContentRows(previous, rows, "append");
    } else if (Array.isArray(incoming)) {
      merged[field] = Array.isArray(previous) ? [...previous, ...incoming] : incoming;
    } else if (typeof incoming === "string") {
      merged[field] = typeof previous === "string" && previous.trim() ? `${previous}<br/><br/>${incoming}` : incoming;
    } else {
      merged[field] = previous;
    }
  }
  return merged;
}
