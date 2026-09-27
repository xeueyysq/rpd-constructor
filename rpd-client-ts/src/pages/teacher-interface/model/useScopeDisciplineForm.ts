import { saveStudyPlan } from "../api/studyPlan";
import { useTemplateSync, type FieldEdits } from "@entities/template";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
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
  const dirtyZet = useTemplateSync((state) => Boolean(state.dirty.zet));
  const dirtyStudyLoad = useTemplateSync((state) =>
    Boolean(state.dirty.study_load)
  );
  const [creditUnits, setCreditUnits] = useState("");
  const [academicHours, setAcademicHours] = useState<string | number>("");
  const plan = jsonData.study_plan_hours as StudyPlanHours | undefined;
  const hours = plan?.has_total
    ? plan.all
    : sumContentHours(jsonData.content as DisciplineContentData | undefined)
        .all;

  useEffect(() => {
    if (!dirtyZet) setCreditUnits(readZet(jsonData.zet, jsonData.zets));
    if (!dirtyStudyLoad) setAcademicHours(hours);
  }, [
    templateId,
    hours,
    jsonData.zet,
    jsonData.zets,
    dirtyZet,
    dirtyStudyLoad,
  ]);

  const save = useCallback(
    async (field: "zet" | "study_load") => {
      const value = Number(field === "zet" ? creditUnits : academicHours);
      if (!Number.isFinite(value) || value < 0) {
        showErrorMessage(
          field === "zet"
            ? "Введите корректное число зачетных единиц"
            : "Введите корректное число часов"
        );
        return;
      }
      const current = useStore.getState().jsonData;
      const currentPlan = current.study_plan_hours as
        StudyPlanHours | undefined;
      const currentHours = currentPlan?.has_total
        ? currentPlan.all
        : sumContentHours(current.content as DisciplineContentData | undefined)
            .all;
      if (
        value ===
        (field === "zet"
          ? Number(current.zet ?? current.zets ?? 0)
          : currentHours)
      ) {
        useTemplateSync.getState().clearDirty(field);
        return;
      }
      if (!templateId) return;
      try {
        const updated = await useTemplateSync
          .getState()
          .track(
            saveStudyPlan(
              templateId,
              field === "zet" ? { zet: value } : { hours: { all: value } }
            )
          );
        if (useStore.getState().jsonData.id === templateId) {
          updateJsonData("study_load", updated.study_load);
          updateJsonData("zet", updated.zet);
          updateJsonData("study_plan_hours", updated.study_plan_hours);
          updateJsonData("field_edits", {
            ...(useStore.getState().jsonData.field_edits as
              FieldEdits | undefined),
            ...updated.edits,
          });
          useTemplateSync.getState().clearDirty(field);
        }
      } catch (error) {
        showErrorMessage("Ошибка сохранения данных");
        console.error(error);
      }
    },
    [academicHours, creditUnits, templateId, updateJsonData]
  );

  return {
    creditUnits,
    setCreditUnits: (value: string) => {
      useTemplateSync.getState().markDirty("zet");
      setCreditUnits(value);
    },
    academicHours,
    setAcademicHours: (value: string) => {
      useTemplateSync.getState().markDirty("study_load");
      setAcademicHours(value);
    },
    save,
  };
}
