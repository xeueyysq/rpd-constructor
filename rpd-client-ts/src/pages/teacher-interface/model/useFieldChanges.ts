import { useCallback, useState } from "react";
import { acknowledgeFieldChanges } from "@features/complect-sync";
import type { TemplateFieldChange } from "@shared/types/templateFieldChange";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";

export const useFieldChanges = () => {
  const jsonData = useStore((state) => state.jsonData);
  const setJsonData = useStore((state) => state.setJsonData);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const fieldChanges: TemplateFieldChange[] = Array.isArray(
    jsonData?.fieldChanges
  )
    ? jsonData.fieldChanges
    : [];

  const handleAcknowledge = useCallback(
    async (changeIds: number[]) => {
      if (!jsonData?.id) return;
      setIsAcknowledging(true);
      try {
        await acknowledgeFieldChanges({
          profileTemplateId: jsonData.id,
          changeIds,
        });
        setJsonData({
          ...jsonData,
          fieldChanges: fieldChanges.filter(
            (change) => !changeIds.includes(change.id)
          ),
        });
      } catch (error) {
        console.error(error);
        showErrorMessage("Не удалось подтвердить изменение");
      } finally {
        setIsAcknowledging(false);
      }
    },
    [fieldChanges, jsonData, setJsonData]
  );

  return { fieldChanges, handleAcknowledge, isAcknowledging };
};
