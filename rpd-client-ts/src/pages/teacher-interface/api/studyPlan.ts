import {
  axiosBase,
  getSessionGeneration,
  SessionChangedError,
  subscribeToSessionGeneration,
} from "@shared/api";
import type { FieldEdits } from "@entities/template";
import type { StudyPlanHours } from "../model/DisciplineContentPageTypes";

type StudyPlanResult = {
  study_load: unknown;
  zet: number;
  study_plan_hours: StudyPlanHours;
  edits: FieldEdits;
};

const queues = new Map<number, Promise<StudyPlanResult>>();
subscribeToSessionGeneration(() => queues.clear());

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
): Promise<StudyPlanResult> {
  const generation = getSessionGeneration();
  const previous = queues.get(templateId);
  const request = (previous ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      if (generation !== getSessionGeneration())
        throw new SessionChangedError();
      const response = await axiosBase.put<StudyPlanResult>(
        `rpd-profile-templates/${templateId}/study-load`,
        patch
      );
      return response.data;
    });
  queues.set(templateId, request);
  void request.then(
    () => {
      if (queues.get(templateId) === request) queues.delete(templateId);
    },
    () => {
      if (queues.get(templateId) === request) queues.delete(templateId);
    }
  );
  return request;
}
