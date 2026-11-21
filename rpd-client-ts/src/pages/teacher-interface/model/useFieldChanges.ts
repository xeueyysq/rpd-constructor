import type { TemplateFieldChange } from "@shared/types/templateFieldChange";
import { useStore } from "@shared/hooks";
import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";

export const useFieldChanges = () => {
  const jsonData = useStore((state) => state.jsonData);
  const userRole = useAuth((state) => state.userRole);
  const fieldChanges: TemplateFieldChange[] =
    userRole !== UserRole.TEACHER && Array.isArray(jsonData?.fieldChanges)
      ? jsonData.fieldChanges
      : [];
  return { fieldChanges };
};
