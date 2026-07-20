import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export function formatStatusDate(date: string | null | undefined): string | null {
  if (!date) return null;
  try {
    return format(parseISO(date), "d MMMM yyyy, HH:mm", { locale: ru });
  } catch {
    return null;
  }
}
