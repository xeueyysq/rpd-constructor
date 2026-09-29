import { statusConfig } from "../model/templateStatusCodes";

export function getTemplateStatusLabel(
  code: string | null | undefined
): string {
  if (!code) return "";

  return statusConfig[code as keyof typeof statusConfig]?.label ?? code;
}
