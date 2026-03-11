import { PlannedResultsData } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { AssessmentToolsQuestionsData, CompetenceGroup } from "./types";

export const buildCompetenceGroups = (
  data: PlannedResultsData | undefined
): CompetenceGroup[] => {
  if (!data) return [];

  const groups = new Map<string, CompetenceGroup>();
  let currentCompetence = "";
  const keys = Object.keys(data).sort((a, b) => Number(a) - Number(b));

  for (const key of keys) {
    const row = data[key];
    if (!row) continue;

    const rawCompetence = String(row.competence ?? "").trim();
    const competence = rawCompetence || currentCompetence;
    if (!competence) continue;
    if (rawCompetence) currentCompetence = competence;

    if (!groups.has(competence)) {
      groups.set(competence, { competence });
    }
  }

  return Array.from(groups.values());
};

export const normalizeFunds = (
  base: AssessmentToolsQuestionsData | undefined,
  groups: CompetenceGroup[]
): AssessmentToolsQuestionsData => {
  const baseCompetencies = base?.competencies ?? {};
  const normalized: AssessmentToolsQuestionsData = {
    controlQuestions: base?.controlQuestions ?? "",
    competencies: {},
  };

  for (const group of groups) {
    const prev = baseCompetencies[group.competence] as
      | {
          openQuestions?: string;
          closedQuestions?: string;
          selectedIndicator?: string;
          indicators?: Record<
            string,
            { openQuestions?: string; closedQuestions?: string }
          >;
        }
      | undefined;
    let openQuestions = prev?.openQuestions ?? "";
    let closedQuestions = prev?.closedQuestions ?? "";

    if (
      (!openQuestions && !closedQuestions && prev?.indicators) ||
      (prev?.indicators &&
        (prev?.openQuestions === undefined || prev?.closedQuestions === undefined))
    ) {
      const indicators = prev.indicators;
      const selected =
        (prev.selectedIndicator && indicators?.[prev.selectedIndicator]) ||
        Object.values(indicators ?? {})[0];
      openQuestions = selected?.openQuestions ?? openQuestions;
      closedQuestions = selected?.closedQuestions ?? closedQuestions;
    }

    normalized.competencies[group.competence] = {
      openQuestions,
      closedQuestions,
    };
  }

  return normalized;
};
