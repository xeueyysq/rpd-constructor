import { saveStudyPlan } from "../api/studyPlan";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useCallback, useEffect, useState } from "react";
import type { StudyPlanHours } from "./DisciplineContentPageTypes";
import { sumContentHours } from "../lib/hours";
import type { DisciplineContentData } from "./DisciplineContentPageTypes";

function readZet(zet: unknown, zets: unknown): string {
  const value = zet ?? zets;
  return value === null || value === undefined || value === ""
    ? ""
    : String(value);
}

export function useScopeDisciplineForm() {
  const jsonData = useStore((state) => state.jsonData);
  const templateId = jsonData.id;
  const updateJsonData = useStore((state) => state.updateJsonData);
  const [creditUnits, setCreditUnits] = useState("");
  const [academicHours, setAcademicHours] = useState<string | number>("");
  const plan = jsonData.study_plan_hours as StudyPlanHours | undefined;
  const hours = plan?.has_total
    ? plan.all
    : sumContentHours(jsonData.content as DisciplineContentData | undefined)
        .all;

  useEffect(() => {
    setCreditUnits(readZet(jsonData.zet, jsonData.zets));
    setAcademicHours(hours);
  }, [templateId, hours, jsonData.zet, jsonData.zets]);

  const save = useCallback(async () => {
    const parsedHours = Number(academicHours);
    if (!Number.isFinite(parsedHours) || parsedHours < 0) {
      showErrorMessage("Введите корректное число часов");
      return;
    }
    const parsedZet = Number(creditUnits);
    if (!Number.isFinite(parsedZet) || parsedZet < 0) {
      showErrorMessage("Введите корректное число зачетных единиц");
      return;
    }
    if (!templateId) return;
    try {
      const updated = await saveStudyPlan(templateId, {
        hours: { all: parsedHours },
        zet: parsedZet,
      });
      updateJsonData("study_load", updated.study_load);
      updateJsonData("zet", updated.zet);
      updateJsonData("study_plan_hours", updated.study_plan_hours);
      showSuccessMessage("Данные сохранены");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  }, [academicHours, creditUnits, templateId, updateJsonData]);

  return { creditUnits, setCreditUnits, academicHours, setAcademicHours, save };
}
