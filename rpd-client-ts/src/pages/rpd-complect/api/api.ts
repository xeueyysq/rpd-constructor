import { axiosBase } from "@shared/api";
import type { ComplectMeta, ComplectRpdDto } from "../types";

export async function fetchComplectRpd(
  complectId: string | undefined
): Promise<ComplectMeta> {
  const { data } = await axiosBase.post<ComplectRpdDto>("find-rpd", {
    complectId,
  });
  const {
    direction,
    education_form,
    education_level,
    last_synced_at,
    has_pending_changes,
    ...meta
  } = data;
  return {
    ...meta,
    directionOfStudy: direction,
    formEducation: education_form,
    levelEducation: education_level,
    lastSyncedAt: last_synced_at,
    hasPendingChanges: has_pending_changes,
  };
}
