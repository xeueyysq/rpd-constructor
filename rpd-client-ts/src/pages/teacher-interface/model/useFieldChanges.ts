import type { TemplateFieldChange } from "@shared/types/templateFieldChange";
import { useStore } from "@shared/hooks";

export const useFieldChanges = () => {
  const jsonData = useStore((state) => state.jsonData);
  const fieldChanges: TemplateFieldChange[] = Array.isArray(
    jsonData?.fieldChanges
  )
    ? jsonData.fieldChanges
    : [];
  return { fieldChanges };
};
