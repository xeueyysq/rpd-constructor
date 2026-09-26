export interface UserRow {
  id: number;
  name: string;
  password: string;
  role: number;
  fullname: unknown | null;
  is_active: boolean;
}

export interface RefreshSessionRow {
  finger_print: string;
}

export interface RpdComplectRow {
  id: number;
  uuid: string;
  faculty: string | null;
  year: number | null;
  education_form: string | null;
  education_level: string | null;
  profile: string | null;
  direction: string | null;
  last_synced_at: Date | null;
  has_pending_changes: boolean;
}

export interface Rpd1cExchangeRow {
  id: number;
  id_rpd_complect: number;
  department: string | null;
  discipline: string | null;
  teachers: string[] | null;
  teacher: string | null;
  zet: number | null;
  place: string | null;
  record_type: string | null;
  study_load: unknown | null;
  control_load: unknown | null;
  semester: number | null;
  removed_at: Date | null;
}

export interface RpdProfileTemplateRow {
  id: number;
  public_id: string;
  id_rpd_complect: number;
  disciplins_name: string | null;
  department: string | null;
  teacher: string | null;
  goals: string | null;
  place: string | null;
  semester: number | null;
  certification: string | null;
  place_more_text: string | null;
  competencies: unknown | null;
  zet: number | null;
  content: unknown | null;
  study_load: unknown | null;
  control_load: unknown | null;
  content_more_text: string | null;
  content_template_more_text: string | null;
  methodological_support_template: string | null;
  assessment_tools_template: string | null;
  assessment_tools_questions: unknown | null;
  textbook: string[] | null;
  additional_textbook: string[] | null;
  professional_information_resources: string | null;
  software: string | null;
  logistics_template: string | null;
}
