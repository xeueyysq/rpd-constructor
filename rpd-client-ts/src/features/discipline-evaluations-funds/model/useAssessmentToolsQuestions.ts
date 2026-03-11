import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks/useStore.tsx";
import {
  showErrorMessage,
  showSuccessMessage,
} from "@shared/lib/showMessage.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssessmentToolsQuestionsData } from "./types";
import { buildCompetenceGroups, normalizeFunds } from "./utils";
import { PlannedResultsData } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";

type UseAssessmentToolsQuestionsResult = {
  competenceGroups: { competence: string }[];
  fundsData: AssessmentToolsQuestionsData;
  handleControlQuestionsChange: (value: string) => void;
  handleQuestionChange: (
    competence: string,
    field: "openQuestions" | "closedQuestions",
    value: string
  ) => void;
  saveFundsData: () => Promise<void>;
};

export const useAssessmentToolsQuestions = (): UseAssessmentToolsQuestionsResult => {
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

  const [plannedResults, setPlannedResults] = useState<
    PlannedResultsData | undefined
  >(() => initialPlannedResults);

  useEffect(() => {
    setPlannedResults(initialPlannedResults);
  }, [initialPlannedResults]);

  useEffect(() => {
    if (plannedResults && Object.keys(plannedResults).length) return;
    if (!complectId) return;

    let isActive = true;

    (async () => {
      try {
        const response = await axiosBase.get("get-results-data", {
          params: { complectId },
        });
        type Row = {
          competence: string;
          indicator: string;
          disciplines: string[];
        };
        const rows = response.data as Row[];
        const filtered = rows.filter((r) =>
          r.disciplines.includes(disciplineName)
        );

        const mapped: PlannedResultsData = {};
        let idx = 0;
        let lastCompetence = "";
        filtered.forEach((r) => {
          const competenceToSet =
            r.competence === lastCompetence ? "" : r.competence;
          lastCompetence = r.competence;
          mapped[idx++] = {
            competence: competenceToSet,
            indicator: r.indicator,
            results: { know: "", beAble: "", own: "" },
          };
        });

        if (isActive) setPlannedResults(mapped);
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [plannedResults, complectId, disciplineName]);

  const competenceGroups = useMemo(
    () => buildCompetenceGroups(plannedResults),
    [plannedResults]
  );

  const [fundsData, setFundsData] = useState<AssessmentToolsQuestionsData>(() =>
    normalizeFunds(storedFunds, competenceGroups)
  );

  const templateIdRef = useRef(templateId);
  useEffect(() => {
    const templateChanged = templateIdRef.current !== templateId;
    templateIdRef.current = templateId;

    setFundsData((prev) => {
      const base = templateChanged ? storedFunds : storedFunds ?? prev;
      return normalizeFunds(base, competenceGroups);
    });
  }, [storedFunds, competenceGroups, templateId]);

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
    handleControlQuestionsChange,
    handleQuestionChange,
    saveFundsData,
  };
};
