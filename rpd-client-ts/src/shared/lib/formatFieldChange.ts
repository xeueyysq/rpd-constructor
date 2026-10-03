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
  __new__: "Новая дисциплина",
  removed: "Удалена из плана",
};

export const formatFieldChangeValue = (value: unknown): string => {
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
  `${getFieldLabel(field)}: ${formatFieldChangeValue(oldValue)} → ${formatFieldChangeValue(newValue)}`;

// Маркеры `__new__` и `removed` хранят `{ discipline }` — в таблице показываем название.
export const formatFieldChangeCell = (
  field: string,
  value: unknown
): string => {
  if (
    (field === "__new__" || field === "removed") &&
    typeof value === "object" &&
    value !== null &&
    "discipline" in value &&
    typeof value.discipline === "string"
  ) {
    return value.discipline;
  }
  return formatFieldChangeValue(value);
};
