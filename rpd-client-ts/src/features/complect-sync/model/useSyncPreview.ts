import { useMutation } from "@tanstack/react-query";
import { fetchSyncPreview } from "../api/syncComplect";

export const useSyncPreviewMutation = () =>
  useMutation({
    mutationFn: (complectId: string) => fetchSyncPreview(complectId),
  });
