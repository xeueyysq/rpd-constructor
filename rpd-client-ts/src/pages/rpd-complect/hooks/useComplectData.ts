import { TemplateStatusEnum } from "@entities/template";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateTemplateFrom1c } from "@features/create-rpd-template";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useMemo, useState } from "react";
import { fetchComplectRpd } from "../api";
import { sortTemplatesByStatus } from "../utils/sortTemplates";

const statusPriority = { [TemplateStatusEnum.UNLOADED]: 1 };

export function useComplectData(complectId: string | undefined) {
  const queryClient = useQueryClient();
  const createTemplate = useCreateTemplateFrom1c();
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<
    Record<number, number[]>
  >({});
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

  const createTemplateData = async (id: number) => {
    if (!complectMeta?.id) return;
    try {
      await createTemplate.mutateAsync({
        id_1c: id,
        complectId: complectMeta.id,
        teacherIds: selectedTeacherIds[id] ?? [],
      });
      showSuccessMessage("Шаблон успешно создан");
      setSelectedTeacherIds((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось создать шаблон");
    }
  };

  return {
    complectMeta,
    selectedTeacherIds,
    setSelectedTeacherIds,
    filteredData,
    fetchComplectData,
    createTemplateData,
  };
}
