import { disciplineJsonSchema } from "./discipline-schema.ts";
import type { DisciplineJson } from "../../types/discipline.ts";

export function validateDisciplineJson(
  data: unknown,
):
  | { success: true; data: DisciplineJson }
  | { success: false; error: string } {
  const r = disciplineJsonSchema.safeParse(data);
  if (!r.success) {
    return { success: false, error: r.error.message };
  }
  return { success: true, data: r.data as DisciplineJson };
}
