import { Unprocessable } from "../utils/Errors.ts";

export type PlannedResultEntry = { competence: string; indicator: string; disciplines: string[] };

// Весь файл проверяется до открытия транзакции; плохая строка не может очистить набор.
export function parsePlannedResults(value: unknown): PlannedResultEntry[] {
  if (!Array.isArray(value) || value.length === 0) throw new Unprocessable("Укажите непустую матрицу компетенций");
  const competencies = new Map<string, Map<string, PlannedResultEntry>>();
  const entries: PlannedResultEntry[] = [];
  for (const row of value as unknown[]) {
    if (!row || typeof row !== "object" || Array.isArray(row)
      || !("competence" in row) || typeof row.competence !== "string" || !row.competence.trim()
      || !("indicator" in row) || typeof row.indicator !== "string" || !row.indicator.trim()
      || !("disciplines" in row) || !Array.isArray(row.disciplines)
      || row.disciplines.some((discipline: unknown) => typeof discipline !== "string" || !discipline.trim())) {
      throw new Unprocessable("Каждая строка должна содержать компетенцию, индикатор и массив непустых названий дисциплин");
    }
    const competence = row.competence.trim();
    const indicator = row.indicator.trim();
    let indicators = competencies.get(competence);
    if (!indicators) { indicators = new Map(); competencies.set(competence, indicators); }
    let entry = indicators.get(indicator);
    if (!entry) {
      entry = { competence, indicator, disciplines: [] };
      indicators.set(indicator, entry);
      entries.push(entry);
    }
    entry.disciplines = [...new Set([...entry.disciplines, ...row.disciplines.map((discipline: string) => discipline.trim())])];
  }
  return entries;
}
