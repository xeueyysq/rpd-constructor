import { axiosBase } from "@shared/api";
import type { SyncApplySelection, SyncPreviewResponse } from "../model/types";

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
}) => {
  const { data } = await axiosBase.post<{
    complectId: number;
    syncLogId: number;
  }>("complects/sync/apply", payload);
  return data;
};

export const acknowledgeFieldChanges = async (payload: {
  profileTemplateId: number;
  changeIds?: number[];
}) => {
  const { data } = await axiosBase.post<{ acknowledged: boolean }>(
    "acknowledge-field-changes",
    payload
  );
  return data;
};
