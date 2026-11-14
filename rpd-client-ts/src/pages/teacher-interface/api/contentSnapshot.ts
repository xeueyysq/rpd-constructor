import { useMutation } from "@tanstack/react-query";
import { axiosBase } from "@shared/api";
import type { FieldEdits } from "@entities/template";
import type {
  DisciplineContentData,
  StudyPlanHours,
} from "../model/DisciplineContentPageTypes";

type ContentSnapshot = {
  content: DisciplineContentData;
  study_load: unknown;
  study_plan_hours: StudyPlanHours;
  zet: number;
  certification: string;
  derived_certification?: string;
  field_edits?: FieldEdits;
};

export function useContentSnapshot() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await axiosBase.post<ContentSnapshot>("rpd-profile-templates", { id }))
        .data,
    retry: false,
  });
}
