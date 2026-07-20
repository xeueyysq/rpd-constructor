const FIELD_LABELS: Record<string, string> = {
  discipline: "Дисциплина",
  department: "Кафедра",
  semester: "Семестр",
  zet: "ЗЕТ",
  place: "Место в ОПОП",
  study_load: "Учебная нагрузка",
  control_load: "Контрольная нагрузка",
  teachers: "Преподаватели",
  certification: "Аттестация",
};

const formatValue = (value: unknown): string => {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const getFieldLabel = (field: string) => FIELD_LABELS[field] ?? field;

export const formatFieldChangeLine = (
  field: string,
  oldValue: unknown,
  newValue: unknown
) =>
  `${getFieldLabel(field)}: ${formatValue(oldValue)} → ${formatValue(newValue)}`;
