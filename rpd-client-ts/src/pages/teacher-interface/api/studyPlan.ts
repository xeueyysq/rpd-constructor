import { axiosBase } from "@shared/api";
import type {
  DisciplineContentData,
  StudyPlanHours,
} from "../model/DisciplineContentPageTypes";

export async function saveDisciplineContent(
  templateId: number,
  content: DisciplineContentData
) {
  await axiosBase.put(`update-json-value/${templateId}`, {
    fieldToUpdate: "content",
    value: content,
  });
}

export async function saveStudyPlan(
  templateId: number,
  patch: {
    hours?: Partial<
      Pick<
        StudyPlanHours,
        "all" | "lectures" | "seminars" | "control" | "independent_work"
      >
    >;
    zet?: number;
  }
): Promise<{
  study_load: unknown;
  zet: number;
  study_plan_hours: StudyPlanHours;
}> {
  const response = await axiosBase.put(
    `rpd-profile-templates/${templateId}/study-load`,
    patch
  );
  return response.data;
}
