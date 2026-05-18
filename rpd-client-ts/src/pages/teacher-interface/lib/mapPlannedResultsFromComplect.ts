import type { PlannedResultsData } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";

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
  const filtered = rows.filter((r) => r.disciplines.includes(disciplineName));

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
