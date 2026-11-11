import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { isAxiosError } from "axios";
import { fetchComplectRpd } from "../api";

export function useComplectData(complectId: string | undefined) {
  const queryClient = useQueryClient();
  const { data, error, isError, refetch } = useQuery({
    queryKey: ["rpd-complect", complectId],
    queryFn: () => fetchComplectRpd(complectId),
    enabled: Boolean(complectId),
    retry: (count, error) =>
      !(isAxiosError(error) && error.response?.status === 403) && count < 3,
  });
  const complectMeta = isError ? undefined : data;

  const fetchComplectData = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["exchange-changes"] }),
    ]);
  };
  const filteredData = useMemo(
    () => complectMeta?.templates ?? [],
    [complectMeta?.templates]
  );

  return {
    complectMeta,
    isError,
    isForbidden: isAxiosError(error) && error.response?.status === 403,
    filteredData,
    fetchComplectData,
  };
}
