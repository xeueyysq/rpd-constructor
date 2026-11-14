import type { FieldEdit, FieldEdits } from "./fieldEdits";
import type { TemplateParticipant, TemplateStatusCode } from "./workflow";

export type ImportField =
  | "protocol"
  | "goals"
  | "place_more_text"
  | "content"
  | "content_more_text"
  | "content_template_more_text"
  | "methodological_support_template"
  | "textbook"
  | "additional_textbook"
  | "professional_information_resources"
  | "software"
  | "logistics_template";
export type ImportContext = (
  | { targetTemplateId: number | string; targetComplectId?: never }
  | { targetComplectId: number | string; targetTemplateId?: never }
) & { ownOnly?: boolean };
export type ImportCatalogQuery = ImportContext & {
  scope: "bulk" | "single" | "field";
  search?: string;
  faculty?: string;
  educationLevel?: string;
  direction?: string;
  profile?: string;
  educationForm?: string;
  year?: number;
  status?: "ready";
  sourceMode?: "other-complect" | "other-year";
  page?: number;
  pageSize?: number;
};
export type ImportCatalogSummary = Omit<ImportSourceComplect, "templates"> & {
  templateCount: number;
  matchingTemplateCount: number;
};
export type ImportCatalogFacets = {
  faculties: string[];
  educationLevels: string[];
  directions: string[];
  profiles: string[];
  educationForms: string[];
  years: number[];
};
export type ImportCatalogResponse = {
  scope: ImportCatalogQuery["scope"];
  targetRevision: string;
  targetEducationLevel: string | null;
  complects: ImportCatalogSummary[];
  templates: ImportCatalogTemplate[];
  page: number;
  pageSize: number;
  total: number;
  facets: ImportCatalogFacets;
};
export type WordImportField =
  | "goals"
  | "place_more_text"
  | "content_more_text"
  | "content_template_more_text"
  | "methodological_support_template"
  | "software"
  | "textbook"
  | "additional_textbook"
  | "professional_information_resources"
  | "content";
export type WordContentRow = {
  theme: string;
  total: number;
  lectures: number;
  seminars: number;
  contact: number;
  independent_work: number;
  control: null;
};
export type WordValues = Partial<
  Record<Exclude<WordImportField, "content">, string | string[]>
> & {
  content?: Record<string, WordContentRow>;
};
export type WordImportPreview = {
  targetTemplateId: number;
  targetRevision: string;
  source: {
    fileName: string;
    discipline: string | null;
    department: string | null;
    year: number | null;
  };
  values: WordValues;
  availableFields: WordImportField[];
  warnings: string[];
};
export type WordImportApplyResponse = {
  success: true;
  updatedFields: WordImportField[];
  targetTemplate: ImportTarget;
  targetRevision: string;
};
export interface ImportSourceTemplate {
  id: number;
  public_id: string;
  disciplins_name: string | null;
  semester: number | null;
  record_type: string | null;
  status: TemplateStatusCode;
  participants: Omit<TemplateParticipant, "updatedAt">[];
}
export interface ImportSourceComplect {
  id: number;
  uuid: string;
  faculty: string | null;
  direction: string | null;
  profile: string | null;
  year: number | null;
  education_form: string | null;
  education_level: string | null;
  owners: { userId: number; fullname: string }[];
  templates: ImportSourceTemplate[];
}
export type ImportCatalogTemplate = ImportSourceTemplate & {
  complect: Omit<ImportSourceComplect, "templates">;
};
export type ImportFieldPreview = { id: number; public_id: string } & Partial<
  Record<ImportField, unknown>
>;
export type ImportTarget = Record<string, unknown> & {
  id: number;
  field_edits: FieldEdits;
};
export type CopyTemplateResponse = {
  success: true;
  message: string;
  targetTemplate: ImportTarget;
  targetRevision: string;
  value?: unknown;
  edit?: FieldEdit;
};
export type ImportSkipReason =
  | "missing_source"
  | "ambiguous"
  | "source_missing_template"
  | "target_missing_template"
  | "read_only";
type BulkEntry = {
  targetExchangeId: number;
  targetTemplateId: number | null;
  discipline: string | null;
  semester: number | null;
  record_type: string | null;
};
export type ImportComplectResponse = {
  imported: Array<
    BulkEntry & { sourceExchangeId: number; sourceTemplateId: number }
  >;
  skipped: Array<BulkEntry & { reason: ImportSkipReason }>;
  counts: { imported: number; skipped: number; total: number };
  targetRevision: string;
};

export const importSkipLabels: Record<ImportSkipReason, string> = {
  missing_source: "Нет совпадающей дисциплины в источнике",
  ambiguous: "Неоднозначное совпадение",
  source_missing_template: "В источнике отсутствует РПД",
  target_missing_template: "В целевом комплекте отсутствует РПД",
  read_only: "Целевая РПД недоступна для изменения",
};

export function importComplectLabel(
  complect: Pick<
    ImportSourceComplect,
    "direction" | "profile" | "year" | "education_form" | "education_level"
  >
) {
  return [
    complect.direction,
    complect.profile,
    complect.year,
    complect.education_form,
    complect.education_level,
  ]
    .filter((value) => value != null && value !== "")
    .join(" • ");
}
