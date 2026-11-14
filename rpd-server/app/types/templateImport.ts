import type { RpdProfileTemplateRow } from "./db.ts";
import type { FieldEdit } from "../modules/fieldEdits.ts";
import type { TemplateImportField } from "../modules/templateImport.ts";
import type { WordValues } from "../modules/wordImport/wordAdapter.ts";
import type { ImportSourceComplect, ImportSourceTemplate, ImportSourceComplectMeta } from "../models/template_import.ts";
import type { ParticipationState, TemplateStatus, WorkflowAction } from "../modules/templateWorkflow.ts";
import type { CatalogFacets, CatalogSummary } from "../models/template_import_catalog.ts";

export type TemplateIdentifier = number | string;
export type ImportScope = "bulk" | "single" | "field";
export type ImportSourcesQuery =
  | { scope?: "single" | "field"; targetTemplateId: TemplateIdentifier; targetComplectId?: never }
  | { scope?: "bulk"; targetComplectId: TemplateIdentifier; targetTemplateId?: never };
export type ImportSourcesResponse = { scope: ImportScope; targetRevision: string; complects: ImportSourceComplect[] };
export type ImportCatalogTemplate = ImportSourceTemplate & { complect: ImportSourceComplectMeta };
export type ImportCatalogResponse = {
  scope: ImportScope; targetRevision: string; targetEducationLevel: string | null;
  total: number; page: number; pageSize: number;
  complects: CatalogSummary[]; templates: ImportCatalogTemplate[]; facets: CatalogFacets;
};
export type ImportFieldPreviewQuery = { ids?: TemplateIdentifier | TemplateIdentifier[]; "ids[]"?: TemplateIdentifier | TemplateIdentifier[]; rowName: TemplateImportField; targetTemplateId: TemplateIdentifier; ownOnly?: boolean };
export type ImportFieldPreviewResponse = Array<{ id: number; public_id: string } & Partial<Record<TemplateImportField, unknown>>>;
export type CopyTemplateFieldRequest = { sourceTemplateId: TemplateIdentifier; targetTemplateId: TemplateIdentifier; fieldToCopy: TemplateImportField; baseAt: string | null; ownOnly?: boolean };
// Старый full-copy клиент может не прислать revision. Новый клиент обязан брать
// baseline из каталога для targetTemplateId и передавать его при подтверждении.
export type CopyTemplateContentRequest = { sourceTemplateId: TemplateIdentifier; targetTemplateId: TemplateIdentifier; targetRevision?: string; sourceStatus?: "ready" };
export type CopyTemplateResponse = {
  success: true; message: string;
  targetTemplate: Omit<RpdProfileTemplateRow, "field_edits"> & { field_edits: Record<string, FieldEdit> };
  targetRevision: string; value?: unknown; edit?: FieldEdit;
};
// Legacy sourceStatus валидируется, но больше не ограничивает массовый импорт.
export type ImportComplectRequest = { sourceComplectId: TemplateIdentifier; targetComplectId: TemplateIdentifier; targetRevision: string; sourceStatus?: TemplateStatus | "closed" | null };
export type ImportComplectEntry = { targetExchangeId: number; targetTemplateId: number | null; discipline: string | null; semester: number | null; record_type: string | null };
export type ImportSkipReason = "missing_source" | "ambiguous" | "source_missing_template" | "target_missing_template" | "read_only";
export type ImportComplectResponse = {
  imported: Array<ImportComplectEntry & { sourceExchangeId: number; sourceTemplateId: number }>;
  skipped: Array<ImportComplectEntry & { reason: ImportSkipReason }>;
  counts: { imported: number; skipped: number; total: number }; targetRevision: string;
};
export type SetTemplateParticipantsRequest = { teacherIds: number[]; baseTeacherIds: number[] };
// JSON-представление существующего workflow snapshot (updatedAt сериализован).
export type SetTemplateParticipantsResponse = {
  templateId: number; status: TemplateStatus; statusChangedAt: string | null;
  participants: Array<{ userId: number; fullname: string; state: ParticipationState; isActive: boolean; updatedAt: string }>;
  progress: { done: number; total: number }; allowedActions: WorkflowAction[]; canEditTeachers: boolean;
};
export type ClearTemplateControlRequest = { rowId: string; baseAt: string | null };
export type ClearTemplateControlResponse = { field: "content"; value: unknown; edit: FieldEdit };

// POST /templates/:id/import-word/preview: multipart/form-data, ровно одно поле file (.docx).
export type WordImportPreviewResponse = {
  targetTemplateId: number; targetRevision: string;
  source: { fileName: string; discipline: string | null; department: string | null; year: number | null };
  values: WordValues; availableFields: TemplateImportField[]; warnings: string[];
};
// POST /templates/:id/import-word/apply: application/json, только явные поля из preview.
export type WordImportApplyRequest = {
  expectedRevision: string; mode: "replace" | "append";
  selectedFields: TemplateImportField[]; values: WordValues;
};
export type WordImportApplyResponse = Pick<CopyTemplateResponse, "success" | "targetTemplate" | "targetRevision"> & {
  updatedFields: TemplateImportField[];
};
