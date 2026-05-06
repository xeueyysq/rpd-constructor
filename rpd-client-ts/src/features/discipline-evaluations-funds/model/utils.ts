import {
  AssessmentToolQuestion,
  AssessmentToolQuestionId,
  AssessmentToolsQuestionsData,
  CompetenceAssessmentQuestions,
  CompetenceGroup,
  PlannedResultsData,
} from "./types";

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

  const stableIdFromText = (text: string): AssessmentToolQuestionId => {
    const s = text.trim().toLowerCase();
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `q_${(h >>> 0).toString(16)}`;
  };

  const parseLegacyLines = (value: string | undefined): string[] => {
    if (!value?.trim()) return [];
    return value
      .split(/\r?\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const ensurePoolFromLegacy = (lines: string[]): AssessmentToolQuestion[] => {
    return lines.map((text, idx) => ({
      id: `legacy_${idx}_${stableIdFromText(text)}`,
      text,
    }));
  };

  const sanitizeUniquePoolIds = (
    pool: AssessmentToolQuestion[]
  ): AssessmentToolQuestion[] => {
    const seen = new Set<string>();
    let nonce = 0;
    return pool.map((q) => {
      let id = q.id;
      while (seen.has(id)) {
        nonce += 1;
        id = `${q.id}_dup${nonce}`;
      }
      seen.add(id);
      return { ...q, id, correctAnswer: q.correctAnswer ?? "" };
    });
  };

  const selectAllIds = (pool: AssessmentToolQuestion[]): string[] =>
    pool.map((q) => q.id);

  const renderSelectedText = (
    pool: AssessmentToolQuestion[] | undefined,
    selectedIds: string[] | undefined
  ): string => {
    if (!pool?.length) return "";
    const selected = new Set(selectedIds ?? []);
    const texts = pool
      .filter((q) => selected.has(q.id))
      .map((q) => q.text.trim())
      .filter(Boolean);
    return texts.join("\n");
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
          openPool?: AssessmentToolQuestion[];
          closedPool?: AssessmentToolQuestion[];
          selectedOpenIds?: string[];
          selectedClosedIds?: string[];
        }
      | undefined;
    let openQuestions = prev?.openQuestions ?? "";
    let closedQuestions = prev?.closedQuestions ?? "";

    if (
      (!openQuestions && !closedQuestions && prev?.indicators) ||
      (prev?.indicators &&
        (prev?.openQuestions === undefined ||
          prev?.closedQuestions === undefined))
    ) {
      const indicators = prev.indicators;
      const selected =
        (prev.selectedIndicator && indicators?.[prev.selectedIndicator]) ||
        Object.values(indicators ?? {})[0];
      openQuestions = selected?.openQuestions ?? openQuestions;
      closedQuestions = selected?.closedQuestions ?? closedQuestions;
    }

    const openPoolRaw =
      Array.isArray(prev?.openPool) && prev.openPool.length
        ? prev.openPool.map((q) => ({
            ...q,
            correctAnswer: q.correctAnswer ?? "",
          }))
        : ensurePoolFromLegacy(parseLegacyLines(openQuestions));
    const closedPoolRaw =
      Array.isArray(prev?.closedPool) && prev.closedPool.length
        ? prev.closedPool.map((q) => ({
            ...q,
            correctAnswer: q.correctAnswer ?? "",
          }))
        : ensurePoolFromLegacy(parseLegacyLines(closedQuestions));
    const openPool = sanitizeUniquePoolIds(openPoolRaw);
    const closedPool = sanitizeUniquePoolIds(closedPoolRaw);

    const selectedOpenIds =
      Array.isArray(prev?.selectedOpenIds) && prev.selectedOpenIds.length
        ? prev.selectedOpenIds
        : selectAllIds(openPool);
    const selectedClosedIds =
      Array.isArray(prev?.selectedClosedIds) && prev.selectedClosedIds.length
        ? prev.selectedClosedIds
        : selectAllIds(closedPool);

    const normalizedCompetence: CompetenceAssessmentQuestions = {
      openQuestions: renderSelectedText(openPool, selectedOpenIds),
      closedQuestions: renderSelectedText(closedPool, selectedClosedIds),
      openPool,
      closedPool,
      selectedOpenIds,
      selectedClosedIds,
    };

    normalized.competencies[group.competence] = normalizedCompetence;
  }

  return normalized;
};
