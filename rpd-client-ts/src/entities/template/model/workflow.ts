export type TemplateStatusCode =
  | "unloaded"
  | "created"
  | "on_teacher"
  | "in_progress"
  | "ready"
  | "on_refinement";
export type ParticipationState = "assigned" | "in_progress" | "done";
export type WorkflowAction =
  "assign" | "unassign" | "start" | "finish" | "reopen" | "accept" | "refine";

export interface TemplateParticipant {
  userId: number;
  fullname: string;
  state: ParticipationState;
  isActive: boolean;
  updatedAt: string;
}

export interface TemplateWorkflow {
  templateId: number;
  status: TemplateStatusCode;
  participants: TemplateParticipant[];
  progress: { done: number; total: number };
  allowedActions: WorkflowAction[];
  canEditTeachers: boolean;
}

export interface MyTemplate extends TemplateWorkflow {
  id: number;
  public_id: string;
  disciplins_name: string;
  faculty: string;
  direction: string;
  profile: string;
  education_level: string;
  education_form: string;
  year: number;
  myState: ParticipationState;
}

export const participationLabels: Record<ParticipationState, string> = {
  assigned: "Назначен",
  in_progress: "В работе",
  done: "Готово",
};
