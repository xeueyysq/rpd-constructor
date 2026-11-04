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

// find-rpd возвращает метаданные rpd_complects без SQL-алиасов списка комплектов.
export type ComplectRpdDto = {
  id: number;
  uuid: string;
  faculty: string | null;
  direction: string | null;
  profile: string | null;
  year: number | null;
  education_form: string | null;
  education_level: string | null;
  last_synced_at: string | null;
  has_pending_changes: boolean;
  templates: TemplateData[];
};

export type ComplectMeta = Omit<
  ComplectRpdDto,
  | "direction"
  | "education_form"
  | "education_level"
  | "last_synced_at"
  | "has_pending_changes"
> & {
  directionOfStudy: string | null;
  formEducation: string | null;
  levelEducation: string | null;
  lastSyncedAt: string | null;
  hasPendingChanges: boolean;
};
