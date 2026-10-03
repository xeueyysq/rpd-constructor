import type { ComplectData } from "@shared/types/complect";
import type {
  TemplateParticipant,
  TemplateStatusCode,
  WorkflowAction,
} from "@entities/template";
import type { TeacherHint } from "@features/assign-teachers";

export type DisciplineSyncStatus = "new" | "updated" | "removed" | "unchanged";

export interface TemplateData {
  id: number;
  id_profile_template: number | null;
  profile_template_public_id?: string;
  discipline: string;
  semester: number;
  status: TemplateStatusCode;
  statusChangedAt: string | null;
  participants: TemplateParticipant[];
  progress: { done: number; total: number };
  allowedActions: WorkflowAction[];
  canEditTeachers: boolean;
  teacherHints: TeacherHint[];
  latestChanges: { count: number; lastAppliedAt: string | null };
  syncStatus?: DisciplineSyncStatus;
  syncChangedAt?: string | null;
  lastChangeSummary?: string[];
  hasProfileTemplate?: boolean;
  removed_at?: string | null;
}

export type ComplectMeta = ComplectData & { templates: TemplateData[] };
