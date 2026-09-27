import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acknowledgeFieldChanges, getExchangeChanges } from "./syncComplect";

export function useExchangeChanges(exchangeId: number, open: boolean) {
  return useQuery({
    queryKey: ["exchange-changes", exchangeId],
    queryFn: () => getExchangeChanges(exchangeId),
    enabled: open,
  });
}

export function useAcknowledgeExchangeChanges() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exchangeId: number) => acknowledgeFieldChanges({ exchangeId }),
    onSuccess: async (_result, exchangeId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["exchange-changes", exchangeId],
        }),
        queryClient.invalidateQueries({ queryKey: ["rpd-complect"] }),
        queryClient.invalidateQueries({ queryKey: ["rpd-complects"] }),
      ]);
    },
  });
}
