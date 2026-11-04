import type { RpdProfileTemplateRow } from "./db.ts";
import type { FieldEdit } from "../modules/fieldEdits.ts";
import type { TemplateImportField } from "../modules/templateImport.ts";
import type { ImportSourceComplect } from "../models/template_import.ts";
import type { ParticipationState, TemplateStatus, WorkflowAction } from "../modules/templateWorkflow.ts";

export type TemplateIdentifier = number | string;
export type ImportSourcesQuery =
  | { targetTemplateId: TemplateIdentifier; targetComplectId?: never }
  | { targetComplectId: TemplateIdentifier; targetTemplateId?: never };
export type ImportSourcesResponse = { targetRevision: string; complects: ImportSourceComplect[] };
export type ImportFieldPreviewQuery = { ids?: TemplateIdentifier | TemplateIdentifier[]; "ids[]"?: TemplateIdentifier | TemplateIdentifier[]; rowName: TemplateImportField; targetTemplateId: TemplateIdentifier };
export type ImportFieldPreviewResponse = Array<{ id: number; public_id: string } & Partial<Record<TemplateImportField, unknown>>>;
export type CopyTemplateFieldRequest = { sourceTemplateId: TemplateIdentifier; targetTemplateId: TemplateIdentifier; fieldToCopy: TemplateImportField; baseAt: string | null };
// Старый full-copy клиент может не прислать revision. Новый клиент обязан брать
// baseline из каталога для targetTemplateId и передавать его при подтверждении.
export type CopyTemplateContentRequest = { sourceTemplateId: TemplateIdentifier; targetTemplateId: TemplateIdentifier; targetRevision?: string };
export type CopyTemplateResponse = {
  success: true; message: string;
  targetTemplate: Omit<RpdProfileTemplateRow, "field_edits"> & { field_edits: Record<string, FieldEdit> };
  targetRevision: string; value?: unknown; edit?: FieldEdit;
};
export type ImportComplectRequest = { sourceComplectId: TemplateIdentifier; targetComplectId: TemplateIdentifier; targetRevision: string };
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
