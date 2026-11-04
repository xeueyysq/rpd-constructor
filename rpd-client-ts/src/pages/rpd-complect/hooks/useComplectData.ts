import { TemplateStatusEnum } from "@entities/template";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { fetchComplectRpd } from "../api";
import { sortTemplatesByStatus } from "../utils/sortTemplates";

const statusPriority = { [TemplateStatusEnum.UNLOADED]: 1 };

export function useComplectData(complectId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: complectMeta, refetch } = useQuery({
    queryKey: ["rpd-complect", complectId],
    queryFn: () => fetchComplectRpd(complectId),
    enabled: Boolean(complectId),
  });

  const fetchComplectData = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["exchange-changes"] }),
    ]);
  };
  const filteredData = useMemo(
    () => sortTemplatesByStatus(complectMeta?.templates ?? [], statusPriority),
    [complectMeta?.templates]
  );

  return {
    complectMeta,
    filteredData,
    fetchComplectData,
  };
}
