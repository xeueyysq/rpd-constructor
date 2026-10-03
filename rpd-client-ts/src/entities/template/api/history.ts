import { axiosBase } from "@shared/api";
import { useQuery } from "@tanstack/react-query";

export interface HistoryEvent {
  date: string;
  user: string;
  status: string;
  action?: string;
  comment?: string;
  targetUserId?: number;
}

export const templateHistoryKey = (id: number | null) =>
  ["template-history", id] as const;

export function useTemplateHistory(id: number | null) {
  return useQuery({
    queryKey: templateHistoryKey(id),
    queryFn: async () =>
      (await axiosBase.post<HistoryEvent[]>("get-template-history", { id }))
        .data,
    enabled: id != null,
  });
}
