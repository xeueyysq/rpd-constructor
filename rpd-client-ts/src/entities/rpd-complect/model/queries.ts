import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getRpdComplects, deleteRpdComplects } from "../api/rpdComplects";
import { ComplectData } from "@shared/types";
import { showErrorMessage } from "@shared/lib";

const rpdComplectsQueryKey = ["rpd-complects"] as const;

export const useRpdComplectsQuery = () => {
  const { data, isError, isLoading } = useQuery({
    queryKey: rpdComplectsQueryKey,
    queryFn: getRpdComplects,
    staleTime: 60 * 1000,
  });
  const complects = data || [];

  if (isError) showErrorMessage("Ошибка при получении данных");

  return { complects, isError, isLoading };
};

export const useDeleteRpdComplectsMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRpdComplects,
    onSuccess: (_data, ids) => {
      qc.setQueryData<ComplectData[]>(rpdComplectsQueryKey, (prev) => {
        if (!prev) return prev;
        const toDelete = new Set(ids);
        return prev.filter((c) => !toDelete.has(c.id));
      });
    },
  });
};
