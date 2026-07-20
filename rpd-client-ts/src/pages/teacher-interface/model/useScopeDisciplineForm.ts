import { extractTotalAcademicHours } from "@pages/teacher-interface/ui/changeable-elements/discipline-content-table/utils";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useCallback, useEffect, useState } from "react";

type StudyLoadItem = {
  id: string;
  name: string;
};

function readZetFromJson(zet: unknown, zets: unknown): string {
  const value = zet ?? zets;
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function readHoursFromStudyLoad(studyLoad: unknown): string | number {
  const total = extractTotalAcademicHours(studyLoad);
  return total !== null ? total : "";
}

export function useScopeDisciplineForm() {
  const jsonData = useStore((state) => state.jsonData);
  const templateId = useStore((state) => state.jsonData.id);
  const updateJsonData = useStore((state) => state.updateJsonData);

  const [creditUnits, setCreditUnits] = useState("");
  const [academicHours, setAcademicHours] = useState<string | number>("");

  useEffect(() => {
    setCreditUnits(readZetFromJson(jsonData.zet, jsonData.zets));
    setAcademicHours(readHoursFromStudyLoad(jsonData.study_load));
  }, [templateId]);

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

    const nextStudyLoad: StudyLoadItem[] = [
      { name: "Всего", id: String(parsedHours) },
    ];
    const nextZet = String(parsedZet);

    try {
      await Promise.all([
        axiosBase.put(`update-json-value/${templateId}`, {
          fieldToUpdate: "study_load",
          value: nextStudyLoad,
        }),
        axiosBase.put(`update-json-value/${templateId}`, {
          fieldToUpdate: "zet",
          value: nextZet,
        }),
      ]);
      updateJsonData("study_load", nextStudyLoad);
      updateJsonData("zet", nextZet);
      showSuccessMessage("Данные сохранены");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  }, [academicHours, creditUnits, templateId, updateJsonData]);

  return {
    creditUnits,
    setCreditUnits,
    academicHours,
    setAcademicHours,
    save,
  };
}
