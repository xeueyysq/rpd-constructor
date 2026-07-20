import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks/useStore.tsx";
import {
  showErrorMessage,
  showSuccessMessage,
} from "@shared/lib/showMessage.ts";
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
} from "@pages/teacher-interface/lib/mapPlannedResultsFromComplect.ts";
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
  saveFundsData: () => Promise<void>;
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
    const { updateJsonData } = useStore();
    const complectId = useStore((state) => state.complectId);

    const complectIdRef = useRef(complectId);
    complectIdRef.current = complectId;

    const [plannedResults, setPlannedResults] = useState<
      PlannedResultsData | undefined
    >(() => initialPlannedResults);

    const [complectResultRows, setComplectResultRows] = useState<
      ComplectResultsRow[]
    >([]);

    useEffect(() => {
      setPlannedResults(initialPlannedResults);
    }, [initialPlannedResults]);

    useEffect(() => {
      if (!complectId) {
        setComplectResultRows([]);
        return;
      }
      let active = true;
      (async () => {
        try {
          const { data } = await axiosBase.get<ComplectResultsRow[]>(
            "get-results-data",
            { params: { complectId } }
          );
          if (active) setComplectResultRows(Array.isArray(data) ? data : []);
        } catch (e) {
          console.error(e);
          if (active) setComplectResultRows([]);
        }
      })();
      return () => {
        active = false;
      };
    }, [complectId]);

    const complectFetchKeyRef = useRef<string | null>(null);

    useEffect(() => {
      const fetchKey = `${complectId ?? ""}:${disciplineName}`;

      if (hasPlannedResultsData(initialPlannedResults)) {
        complectFetchKeyRef.current = fetchKey;
        return;
      }
      if (!complectId || !disciplineName) return;
      if (complectFetchKeyRef.current === fetchKey) return;
      complectFetchKeyRef.current = fetchKey;

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
      for (const row of complectResultRows) {
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
      if (!complectId) {
        for (const g of competenceGroups) caps[g.competence] = 0;
        return caps;
      }
      for (const g of competenceGroups) {
        const n = disciplineCountByCompetence[g.competence] ?? 0;
        caps[g.competence] = n >= 1 ? Math.ceil(25 / n) : 0;
      }
      return caps;
    }, [complectId, competenceGroups, disciplineCountByCompetence]);

    const canSelectFn = useMemo(() => {
      return (competence: string) =>
        Boolean(complectId) &&
        (maxSelectableByCompetence[competence] ?? 0) >= 1;
    }, [complectId, maxSelectableByCompetence]);

    const quotaRef = useRef(maxSelectableByCompetence);
    quotaRef.current = maxSelectableByCompetence;

    const [fundsData, setFundsData] = useState<AssessmentToolsQuestionsData>(
      () => normalizeFunds(storedFunds, competenceGroups)
    );

    const templateIdRef = useRef(templateId);
    useEffect(() => {
      const templateChanged = templateIdRef.current !== templateId;
      templateIdRef.current = templateId;

      setFundsData((prev) => {
        const base = templateChanged ? storedFunds : (storedFunds ?? prev);
        return normalizeFunds(base, competenceGroups);
      });
    }, [storedFunds, competenceGroups, templateId]);

    useEffect(() => {
      setFundsData((prev) => {
        let anyChange = false;
        const competencies = { ...prev.competencies };
        const cid = complectIdRef.current;
        for (const g of competenceGroups) {
          const competence = g.competence;
          const raw = competencies[competence];
          if (!raw) continue;
          const max = quotaRef.current[competence] ?? 0;
          let selOpen = [...(raw.selectedOpenIds ?? [])];
          let selClosed = [...(raw.selectedClosedIds ?? [])];
          let rowChanged = false;
          if (!cid || max <= 0) {
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
    }, [maxSelectableByCompetence, complectId, competenceGroups]);

    const handleControlQuestionsChange = (value: string) => {
      setFundsData((prev) => ({
        ...prev,
        controlQuestions: value,
      }));
    };

    const handleQuestionChange = (
      competence: string,
      field: "openQuestions" | "closedQuestions",
      value: string
    ) => {
      setFundsData((prev) => {
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

      setFundsData((prev) => {
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
      });
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

      setFundsData((prev) => {
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
      });
    };

    const updateCorrectAnswer = (
      competence: string,
      kind: "open" | "closed",
      id: string,
      value: string
    ) => {
      const poolKey = kind === "open" ? "openPool" : "closedPool";

      setFundsData((prev) => {
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

      setFundsData((prev) => {
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

      setFundsData((prev) => {
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
      });
    };

    const saveFundsData = async () => {
      if (!templateId) return;

      try {
        await axiosBase.put(`update-json-value/${templateId}`, {
          fieldToUpdate: "assessment_tools_questions",
          value: fundsData,
        });

        updateJsonData("assessment_tools_questions", fundsData);
        showSuccessMessage("Данные успешно сохранены");
      } catch (error) {
        showErrorMessage("Ошибка сохранения данных");
        console.error(error);
      }
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
