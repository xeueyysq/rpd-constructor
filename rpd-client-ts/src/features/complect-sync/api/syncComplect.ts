import { axiosBase } from "@shared/api";
import type {
  SyncApplySelection,
  SyncPreviewResponse,
  TeacherImportResult,
} from "../model/types";
import type { TemplateFieldChange } from "@shared/types/templateFieldChange";

export const fetchSyncPreview = async (complectId: string) => {
  const { data } = await axiosBase.post<SyncPreviewResponse>(
    "complects/sync/preview",
    { complectId }
  );
  return data;
};

export const applySyncChanges = async (payload: {
  complectId: string;
  selections: SyncApplySelection[];
  teacherImportManifest?: string;
}) => {
  const { data } = await axiosBase.post<{
    complectId: number;
    syncLogId: number | null;
    teacherImport?: TeacherImportResult;
  }>("complects/sync/apply", payload);
  return data;
};

export const getExchangeChanges = async (exchangeId: number) => {
  const { data } = await axiosBase.get<
    (TemplateFieldChange & { applied_at: string })[]
  >("complects/sync/changes", { params: { exchangeId } });
  return data;
};
