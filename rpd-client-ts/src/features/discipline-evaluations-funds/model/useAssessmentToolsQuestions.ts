import { axiosBase } from "@shared/api";
import {
  sameValue,
  useTemplateSync,
  useUpdateTemplateField,
} from "@entities/template";
import { useStore } from "@shared/hooks/useStore.tsx";
import { showErrorMessage } from "@shared/lib/showMessage.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssessmentToolsQuestionsData,
  CompetenceAssessmentQuestions,
  PlannedResultsData,
} from "./types";
import {
  hasPlannedResultsData,
  mapComplectResultsToPlannedResults,
  type ComplectResultsRow,
} from "../lib/mapPlannedResultsFromComplect";
import { buildCompetenceGroups, normalizeFunds } from "./utils";

type UseAssessmentToolsQuestionsResult = {
  competenceGroups: { competence: string }[];
  fundsData: AssessmentToolsQuestionsData;
  disciplineCountByCompetence: Record<string, number>;
  maxSelectableByCompetence: Record<string, number>;
  canSelectForCompetence: (competence: string) => boolean;
  handleControlQuestionsChange: (value: string) => void;
  handleQuestionChange: (
    competence: string,
    field: "openQuestions" | "closedQuestions",
    value: string
  ) => void;
  addPoolQuestion: (
    competence: string,
    kind: "open" | "closed",
    text?: string
  ) => void;
  toggleSelectedQuestion: (
    competence: string,
    kind: "open" | "closed",
    id: string,
    checked: boolean
  ) => void;
  updateCorrectAnswer: (
    competence: string,
    kind: "open" | "closed",
    id: string,
    value: string
  ) => void;
  updatePoolQuestionText: (
    competence: string,
    kind: "open" | "closed",
    id: string,
    text: string
  ) => void;
  removePoolQuestion: (
    competence: string,
    kind: "open" | "closed",
    id: string
  ) => void;
  saveFundsData: () => void;
};

function newQuestionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function rebuildCompetencyText(entry: CompetenceAssessmentQuestions): {
  openQuestions: string;
  closedQuestions: string;
} {
  const openPool = entry.openPool ?? [];
  const closedPool = entry.closedPool ?? [];
  const so = new Set(entry.selectedOpenIds ?? []);
  const sc = new Set(entry.selectedClosedIds ?? []);
  return {
    openQuestions: openPool
      .filter((q) => so.has(q.id))
      .map((q) => q.text.trim())
      .filter(Boolean)
      .join("\n"),
    closedQuestions: closedPool
      .filter((q) => sc.has(q.id))
      .map((q) => q.text.trim())
      .filter(Boolean)
      .join("\n"),
  };
}

export const useAssessmentToolsQuestions =
  (): UseAssessmentToolsQuestionsResult => {
    const templateId = useStore((state) => state.jsonData.id);
    const disciplineName = useStore(
      (state) => state.jsonData.disciplins_name
    ) as string;
    const initialPlannedResults = useStore(
      (state) => state.jsonData.competencies
    ) as PlannedResultsData | undefined;
    const storedFunds = useStore(
      (state) => state.jsonData.assessment_tools_questions
    ) as AssessmentToolsQuestionsData | undefined;
    const saveField = useUpdateTemplateField();
    const dirtyFunds = useTemplateSync((state) =>
      Boolean(state.dirty.assessment_tools_questions)
    );
    const complectId = useStore((state) => state.complectId);

    const complectIdRef = useRef(complectId);
    // eslint-disable-next-line react-hooks/refs -- обработчики читают последнее значение комплекта.
    complectIdRef.current = complectId;

    const [plannedResults, setPlannedResults] = useState<
      PlannedResultsData | undefined
    >(() => initialPlannedResults);

    const [complectResults, setComplectResults] = useState<{
      complectId: number;
      rows: ComplectResultsRow[];
    }>();
    // Чужие/ещё не загруженные квоты не означают разрешённую квоту 0.
    // Ключ проверяется уже при render, до effects перехода между комплектами.
    const complectResultRows =
      complectId && complectResults?.complectId === complectId
        ? complectResults.rows
        : undefined;

    useEffect(() => {
      setPlannedResults(initialPlannedResults);
    }, [initialPlannedResults]);

    useEffect(() => {
      setComplectResults(undefined);
      if (!complectId) return;
      let active = true;
      (async () => {
        try {
          const { data } = await axiosBase.get<ComplectResultsRow[]>(
            "get-results-data",
            { params: { complectId } }
          );
          if (active && Array.isArray(data)) {
            setComplectResults({ complectId, rows: data });
          }
        } catch (e) {
          console.error(e);
        }
      })();
      return () => {
        active = false;
      };
    }, [complectId]);

    useEffect(() => {
      if (hasPlannedResultsData(initialPlannedResults)) return;
      if (!complectId || !disciplineName) return;

      let isActive = true;

      (async () => {
        try {
          const response = await axiosBase.get<ComplectResultsRow[]>(
            "get-results-data",
            { params: { complectId } }
          );
          if (!isActive) return;
          setPlannedResults(
            mapComplectResultsToPlannedResults(
              Array.isArray(response.data) ? response.data : [],
              disciplineName
            )
          );
        } catch (error) {
          console.error(error);
          if (isActive) setPlannedResults({});
        }
      })();

      return () => {
        isActive = false;
      };
    }, [complectId, disciplineName, initialPlannedResults]);

    const competenceGroups = useMemo(
      () => buildCompetenceGroups(plannedResults),
      [plannedResults]
    );

    const disciplineCountByCompetence = useMemo(() => {
      const counts: Record<string, number> = {};
      const sets = new Map<string, Set<string>>();
      for (const row of complectResultRows ?? []) {
        const c = String(row.competence ?? "").trim();
        if (!c) continue;
        if (!sets.has(c)) sets.set(c, new Set());
        const set = sets.get(c)!;
        for (const d of row.disciplines ?? []) {
          const t = String(d).trim();
          if (t) set.add(t);
        }
      }
      for (const g of competenceGroups) {
        counts[g.competence] = sets.get(g.competence)?.size ?? 0;
      }
      return counts;
    }, [complectResultRows, competenceGroups]);

    const maxSelectableByCompetence = useMemo(() => {
      const caps: Record<string, number> = {};
      if (!complectResultRows) return caps;
      for (const g of competenceGroups) {
        const n = disciplineCountByCompetence[g.competence] ?? 0;
        caps[g.competence] = n >= 1 ? Math.ceil(25 / n) : 0;
      }
      return caps;
    }, [complectResultRows, competenceGroups, disciplineCountByCompetence]);

    const canSelectFn = useMemo(() => {
      return (competence: string) =>
        Boolean(complectResultRows) &&
        (maxSelectableByCompetence[competence] ?? 0) >= 1;
    }, [complectResultRows, maxSelectableByCompetence]);

    const quotaRef = useRef(maxSelectableByCompetence);
    // eslint-disable-next-line react-hooks/refs -- обработчики читают последнюю квоту выбора.
    quotaRef.current = maxSelectableByCompetence;

    const [fundsData, setFundsData] = useState<AssessmentToolsQuestionsData>(
      () => normalizeFunds(storedFunds, competenceGroups)
    );
    const fundsDataRef = useRef(fundsData);

    useEffect(() => {
      fundsDataRef.current = fundsData;
    }, [fundsData]);

    const templateIdRef = useRef(templateId);
    useEffect(() => {
      const templateChanged = templateIdRef.current !== templateId;
      templateIdRef.current = templateId;

      setFundsData((prev) => {
        if (dirtyFunds && !templateChanged) return prev;
        const base = templateChanged ? storedFunds : (storedFunds ?? prev);
        return normalizeFunds(base, competenceGroups);
      });
    }, [storedFunds, competenceGroups, templateId, dirtyFunds]);

    useEffect(() => {
      if (!complectResultRows) return;
      setFundsData((prev) => {
        let anyChange = false;
        const competencies = { ...prev.competencies };
        for (const g of competenceGroups) {
          const competence = g.competence;
          const raw = competencies[competence];
          if (!raw) continue;
          const max = quotaRef.current[competence] ?? 0;
          let selOpen = [...(raw.selectedOpenIds ?? [])];
          let selClosed = [...(raw.selectedClosedIds ?? [])];
          let rowChanged = false;
          if (max <= 0) {
            if (selOpen.length > 0 || selClosed.length > 0) {
              selOpen = [];
              selClosed = [];
              rowChanged = true;
            }
          } else {
            if (selOpen.length > max) {
              selOpen = selOpen.slice(0, max);
              rowChanged = true;
            }
            if (selClosed.length > max) {
              selClosed = selClosed.slice(0, max);
              rowChanged = true;
            }
          }
          if (!rowChanged) continue;
          anyChange = true;
          const nextEntry: CompetenceAssessmentQuestions = {
            ...raw,
            selectedOpenIds: selOpen,
            selectedClosedIds: selClosed,
          };
          const texts = rebuildCompetencyText(nextEntry);
          competencies[competence] = {
            ...nextEntry,
            openQuestions: texts.openQuestions,
            closedQuestions: texts.closedQuestions,
          };
        }
        return anyChange ? { ...prev, competencies } : prev;
      });
    }, [maxSelectableByCompetence, complectResultRows, competenceGroups]);

    const persistFundsData = (next: AssessmentToolsQuestionsData) => {
      const stored = useStore.getState().jsonData.assessment_tools_questions as
        AssessmentToolsQuestionsData | undefined;
      if (sameValue(next, normalizeFunds(stored, competenceGroups))) {
        useTemplateSync.getState().clearDirty("assessment_tools_questions");
        return;
      }
      void saveField("assessment_tools_questions", next);
    };

    const saveFundsData = () => persistFundsData(fundsDataRef.current);

    const changeFunds = (
      update: (
        previous: AssessmentToolsQuestionsData
      ) => AssessmentToolsQuestionsData,
      immediate = false
    ) => {
      const previous = fundsDataRef.current;
      const next = update(previous);
      if (next === previous) return;
      fundsDataRef.current = next;
      setFundsData(next);
      useTemplateSync.getState().markDirty("assessment_tools_questions");
      if (immediate) persistFundsData(next);
    };

    const handleControlQuestionsChange = (value: string) => {
      changeFunds((prev) => ({
        ...prev,
        controlQuestions: value,
      }));
    };

    const handleQuestionChange = (
      competence: string,
      field: "openQuestions" | "closedQuestions",
      value: string
    ) => {
      changeFunds((prev) => {
        const prevCompetence = prev.competencies[competence] ?? {
          openQuestions: "",
          closedQuestions: "",
          openPool: [],
          closedPool: [],
          selectedOpenIds: [],
          selectedClosedIds: [],
        };

        return {
          ...prev,
          competencies: {
            ...prev.competencies,
            [competence]: {
              ...prevCompetence,
              [field]: value,
            },
          },
        };
      });
    };

    const addPoolQuestion = (
      competence: string,
      kind: "open" | "closed",
      text?: string
    ) => {
      const initialText = (text ?? "").trim();

      changeFunds((prev) => {
        const prevCompetence = prev.competencies[competence] ?? {
          openQuestions: "",
          closedQuestions: "",
          openPool: [],
          closedPool: [],
          selectedOpenIds: [],
          selectedClosedIds: [],
        };

        const id = newQuestionId();
        const poolKey = kind === "open" ? "openPool" : "closedPool";
        const selectedKey =
          kind === "open" ? "selectedOpenIds" : "selectedClosedIds";
        const pool = [...(prevCompetence[poolKey] ?? [])];
        const selected = [...(prevCompetence[selectedKey] ?? [])] as string[];
        const nextPool = [
          ...pool,
          { id, text: initialText, correctAnswer: "" },
        ];
        let nextSelected = [...selected];
        const maxCurrent =
          complectIdRef.current && quotaRef.current[competence] !== undefined
            ? quotaRef.current[competence]
            : 0;
        if (
          maxCurrent >= 1 &&
          complectIdRef.current &&
          !nextSelected.includes(id) &&
          nextSelected.length < maxCurrent
        ) {
          nextSelected = [...nextSelected, id];
        }
        const nextEntry: CompetenceAssessmentQuestions = {
          ...prevCompetence,
          [poolKey]: nextPool,
          [selectedKey]: nextSelected,
        };
        const texts = rebuildCompetencyText(nextEntry);
        return {
          ...prev,
          competencies: {
            ...prev.competencies,
            [competence]: {
              ...nextEntry,
              openQuestions: texts.openQuestions,
              closedQuestions: texts.closedQuestions,
            },
          },
        };
      }, true);
    };

    const toggleSelectedQuestion = (
      competence: string,
      kind: "open" | "closed",
      id: string,
      checked: boolean
    ) => {
      const maxSel = quotaRef.current[competence] ?? 0;
      if (!complectIdRef.current || maxSel < 1) {
        showErrorMessage(
          "Нет данных комплекта для расчёта квоты. Выбор вопросов недоступен."
        );
        return;
      }

      changeFunds((prev) => {
        const prevCompetence = prev.competencies[competence];
        if (!prevCompetence) return prev;

        const selectedKey =
          kind === "open" ? "selectedOpenIds" : "selectedClosedIds";

        const selected = new Set(
          (prevCompetence[selectedKey] ?? []) as string[]
        );
        if (checked) {
          if (selected.has(id)) {
            /* noop */
          } else if (selected.size >= maxSel) {
            showErrorMessage(
              `Выбрано максимум вопросов для этой компетенции (${maxSel}).`
            );
            return prev;
          } else {
            selected.add(id);
          }
        } else {
          selected.delete(id);
        }

        const selectedArr = Array.from(selected);
        const nextEntry: CompetenceAssessmentQuestions = {
          ...prevCompetence,
          [selectedKey]: selectedArr,
        };
        const texts = rebuildCompetencyText(nextEntry);
        return {
          ...prev,
          competencies: {
            ...prev.competencies,
            [competence]: {
              ...nextEntry,
              openQuestions: texts.openQuestions,
              closedQuestions: texts.closedQuestions,
            },
          },
        };
      }, true);
    };

    const updateCorrectAnswer = (
      competence: string,
      kind: "open" | "closed",
      id: string,
      value: string
    ) => {
      const poolKey = kind === "open" ? "openPool" : "closedPool";

      changeFunds((prev) => {
        const prevCompetence = prev.competencies[competence];
        if (!prevCompetence) return prev;

        const poolRaw = [...(prevCompetence[poolKey] ?? [])];
        const nextPool = poolRaw.map((item) =>
          item.id === id ? { ...item, correctAnswer: value } : item
        );

        const nextEntry: CompetenceAssessmentQuestions = {
          ...prevCompetence,
          [poolKey]: nextPool,
        };

        const texts = rebuildCompetencyText(nextEntry);
        return {
          ...prev,
          competencies: {
            ...prev.competencies,
            [competence]: {
              ...nextEntry,
              openQuestions: texts.openQuestions,
              closedQuestions: texts.closedQuestions,
            },
          },
        };
      });
    };

    const updatePoolQuestionText = (
      competence: string,
      kind: "open" | "closed",
      id: string,
      text: string
    ) => {
      const poolKey = kind === "open" ? "openPool" : "closedPool";

      changeFunds((prev) => {
        const prevCompetence = prev.competencies[competence];
        if (!prevCompetence) return prev;

        const poolRaw = [...(prevCompetence[poolKey] ?? [])];
        const nextPool = poolRaw.map((item) =>
          item.id === id ? { ...item, text } : item
        );

        const nextEntry: CompetenceAssessmentQuestions = {
          ...prevCompetence,
          [poolKey]: nextPool,
        };

        const texts = rebuildCompetencyText(nextEntry);
        return {
          ...prev,
          competencies: {
            ...prev.competencies,
            [competence]: {
              ...nextEntry,
              openQuestions: texts.openQuestions,
              closedQuestions: texts.closedQuestions,
            },
          },
        };
      });
    };

    const removePoolQuestion = (
      competence: string,
      kind: "open" | "closed",
      id: string
    ) => {
      const poolKey = kind === "open" ? "openPool" : "closedPool";
      const selectedKey =
        kind === "open" ? "selectedOpenIds" : "selectedClosedIds";

      changeFunds((prev) => {
        const prevCompetence = prev.competencies[competence];
        if (!prevCompetence) return prev;

        const nextPool = (prevCompetence[poolKey] ?? []).filter(
          (q) => q.id !== id
        );
        const nextSelected = (prevCompetence[selectedKey] ?? []).filter(
          (sid) => sid !== id
        );

        const nextEntry: CompetenceAssessmentQuestions = {
          ...prevCompetence,
          [poolKey]: nextPool,
          [selectedKey]: nextSelected,
        };

        const texts = rebuildCompetencyText(nextEntry);
        return {
          ...prev,
          competencies: {
            ...prev.competencies,
            [competence]: {
              ...nextEntry,
              openQuestions: texts.openQuestions,
              closedQuestions: texts.closedQuestions,
            },
          },
        };
      }, true);
    };

    return {
      competenceGroups,
      fundsData,
      disciplineCountByCompetence,
      maxSelectableByCompetence,
      canSelectForCompetence: canSelectFn,
      handleControlQuestionsChange,
      handleQuestionChange,
      addPoolQuestion,
      toggleSelectedQuestion,
      updateCorrectAnswer,
      updatePoolQuestionText,
      removePoolQuestion,
      saveFundsData,
    };
  };
