import { useAuth } from "@entities/auth";
import { TemplateStatusEnum } from "@entities/template";
import { useStore } from "@shared/hooks";
import {
  showErrorMessage,
  showSuccessMessage,
  showWarningMessage,
} from "@shared/lib";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchComplectRpd, createProfileTemplateFrom1c } from "../api";
import {
  parseCreateTemplateResponse,
  parseCreateTemplateError,
} from "../utils/parseCreateTemplateResponse";
import { sortTemplatesByStatus } from "../utils/sortTemplates";
import type { ComplectMeta, TemplateData } from "../types";

export type SelectedTeachersMap = Record<number, string[]>;

export function useComplectData(complectId: number) {
  const selectedTemplateData = useStore.getState().selectedTemplateData;
  const userName = useAuth.getState().userName;
  const [complectMeta, setComplectMeta] = useState<ComplectMeta | undefined>();
  const [selectedTeachers, setSelectedTeachers] = useState<SelectedTeachersMap>(
    {}
  );

  const fetchComplectData = useCallback(async () => {
    try {
      const data = await fetchComplectRpd(complectId);
      setComplectMeta(data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [complectId]);

  useEffect(() => {
    fetchComplectData();
  }, [fetchComplectData]);

  const handleTeachersChange = useCallback(
    (templateId: number, value: string[]) => {
      setSelectedTeachers((prev) => ({ ...prev, [templateId]: value }));
    },
    []
  );

  const createTemplateData = useCallback(
    async (id: number, discipline: string) => {
      const teachers = selectedTeachers[id] ?? [];
      try {
        const response = await createProfileTemplateFrom1c({
          id_1c: id,
          complectId,
          teachers,
          year: selectedTemplateData.year,
          discipline,
          userName,
        });

        const outcome = parseCreateTemplateResponse(response);
        if (outcome.kind === "success") {
          showSuccessMessage(outcome.message);
          if (outcome.refetch) await fetchComplectData();
        } else if (outcome.kind === "warning") {
          showWarningMessage(outcome.message);
        } else {
          showErrorMessage(outcome.message);
        }
      } catch (error) {
        const { message } = parseCreateTemplateError(error);
        showErrorMessage(message);
        console.error(error);
      }
    },
    [
      selectedTeachers,
      complectId,
      selectedTemplateData.year,
      userName,
      fetchComplectData,
    ]
  );

  const statusPriority: Record<string, number> = useMemo(
    () => ({ [TemplateStatusEnum.UNLOADED]: 1 }),
    []
  );

  const filteredData: TemplateData[] = useMemo(() => {
    if (!complectMeta?.templates) return [];
    return sortTemplatesByStatus(complectMeta.templates, statusPriority);
  }, [complectMeta?.templates, statusPriority]);

  return {
    complectMeta,
    selectedTeachers,
    filteredData,
    fetchComplectData,
    handleTeachersChange,
    createTemplateData,
  };
}
