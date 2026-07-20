import { useMutation } from "@tanstack/react-query";
import { applySyncChanges } from "../api/syncComplect";
import type { SyncApplySelection } from "./types";

export const useSyncApplyMutation = () =>
  useMutation({
    mutationFn: (payload: {
      complectId: string;
      selections: SyncApplySelection[];
    }) => applySyncChanges(payload),
  });
