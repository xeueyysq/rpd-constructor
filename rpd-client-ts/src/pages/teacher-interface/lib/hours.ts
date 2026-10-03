import type {
  DisciplineContentData,
  ObjectHours,
  StudyPlanHours,
} from "../model/DisciplineContentPageTypes";

export function parseHours(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = parseFloat(normalized);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function getRowHours(row: unknown): ObjectHours {
  const value =
    row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const lectures = parseHours(value.lectures);
  const seminars = parseHours(value.seminars);
  const control = parseHours(value.control);
  const independent_work = parseHours(value.independent_work);
  const contact = lectures + seminars;
  return {
    all: contact + control + independent_work,
    lectures,
    seminars,
    contact,
    control,
    independent_work,
  };
}

export function sumContentHours(
  content: DisciplineContentData | undefined
): ObjectHours {
  const sum = getRowHours(null);
  for (const row of Object.values(content ?? {})) {
    const hours = getRowHours(row);
    for (const key of Object.keys(sum) as (keyof ObjectHours)[])
      sum[key] += hours[key];
  }
  return sum;
}

export function isComparableHour(
  key: keyof ObjectHours,
  plan: StudyPlanHours,
  touched: Partial<Record<keyof ObjectHours, true>> = {}
): boolean {
  return key === "all"
    ? plan.has_total || Boolean(touched.all)
    : plan.has_breakdown || Boolean(touched[key]);
}

export type HoursMismatch = {
  key: keyof ObjectHours;
  actual: number;
  planned: number;
};

// Порядок и названия — как в таблице «Содержание дисциплины».
const hourLabels: Record<keyof ObjectHours, string> = {
  all: "всего",
  lectures: "лекции",
  seminars: "практика",
  contact: "контактная работа",
  independent_work: "СРС",
  control: "контроль",
};

export function hoursMismatches(
  sum: ObjectHours,
  plan: StudyPlanHours,
  touched: Partial<Record<keyof ObjectHours, true>> = {}
): HoursMismatch[] {
  return (Object.keys(hourLabels) as (keyof ObjectHours)[])
    .filter(
      (key) => isComparableHour(key, plan, touched) && sum[key] !== plan[key]
    )
    .map((key) => ({ key, actual: sum[key], planned: plan[key] }));
}

export function hoursMatchPlan(
  sum: ObjectHours,
  plan: StudyPlanHours,
  touched: Partial<Record<keyof ObjectHours, true>> = {}
): boolean {
  return hoursMismatches(sum, plan, touched).length === 0;
}

export function describeHoursMismatches(mismatches: HoursMismatch[]): string {
  return mismatches
    .map(
      ({ key, actual, planned }) => `${hourLabels[key]} ${actual} из ${planned}`
    )
    .join("; ");
}
