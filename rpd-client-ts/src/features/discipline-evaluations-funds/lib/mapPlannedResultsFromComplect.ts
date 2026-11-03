import type { PlannedResultsData } from "../model/types";

export type ComplectResultsRow = {
  competence: string;
  indicator: string;
  disciplines: string[];
};

export function hasPlannedResultsData(
  data: PlannedResultsData | undefined
): boolean {
  return !!data && Object.keys(data).length > 0;
}

export function mapComplectResultsToPlannedResults(
  rows: ComplectResultsRow[],
  disciplineName: string
): PlannedResultsData {
  const normalizedName = disciplineName.trim().toLowerCase();
  if (!normalizedName) return {};
  const filtered = rows.filter((r) =>
    r.disciplines.some((name) => name.trim().toLowerCase() === normalizedName)
  );

  const mapped: PlannedResultsData = {};
  let idx = 0;
  let lastCompetence = "";
  filtered.forEach((r) => {
    const competenceToSet = r.competence === lastCompetence ? "" : r.competence;
    lastCompetence = r.competence;
    mapped[idx++] = {
      competence: competenceToSet,
      indicator: r.indicator,
      results: { know: "", beAble: "", own: "" },
    };
  });
  return mapped;
}
