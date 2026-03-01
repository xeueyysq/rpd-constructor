import type { ComplectData } from "@shared/types/complect";

export interface TemplateStatusObject {
  date: string;
  status: string;
  user: string;
}

export interface TemplateData {
  id: number;
  id_profile_template: number;
  profile_template_public_id?: string;
  discipline: string;
  teachers: string[];
  teacher: string;
  semester: number;
  status: TemplateStatusObject;
}

export type ComplectMeta = ComplectData & {
  templates: TemplateData[];
};

export interface CreateTemplateDataParams {
  id_1c: number;
  complectId: string | undefined;
  teachers: string[];
  year: string | undefined;
  discipline: string;
  userName: string | undefined;
}

export type CreateTemplateResponse =
  | string
  | { result: string; missingTeachers?: string[] };
