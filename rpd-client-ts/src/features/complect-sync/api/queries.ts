import { useQuery } from "@tanstack/react-query";
import { getExchangeChanges } from "./syncComplect";

export function useExchangeChanges(exchangeId: number, open: boolean) {
  return useQuery({
    queryKey: ["exchange-changes", exchangeId],
    queryFn: () => getExchangeChanges(exchangeId),
    enabled: open,
  });
}
