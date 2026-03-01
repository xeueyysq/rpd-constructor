import {
  DisciplineContentData,
  ObjectHours,
} from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import {
  DisciplineContentRow,
  EMPTY_HOURS,
  StudyLoad,
  StudyLoadCategory,
} from "./types";

const TOTAL_LABELS = ["всего", "итого"];
const LECTURES_LABELS = ["лекц"];
const SEMINARS_LABELS = ["практич", "семинар", "лаб"];
const INDEPENDENT_LABELS = ["срс", "самостоят"];
const CONTROL_LABELS = ["контрол", "экзам", "зач", "аттест"];

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

export function toNumberSafe(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
    const fallback = parseFloat(normalized);
    return Number.isFinite(fallback) ? fallback : 0;
  }
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function getStudyLoadCategory(label: string): StudyLoadCategory {
  if (!label) return "unknown";
  if (includesAny(label, TOTAL_LABELS)) return "total";
  if (includesAny(label, LECTURES_LABELS)) return "lectures";
  if (includesAny(label, SEMINARS_LABELS)) return "seminars";
  if (includesAny(label, INDEPENDENT_LABELS)) return "independent";
  if (includesAny(label, CONTROL_LABELS)) return "control";
  return "unknown";
}

export function sumControlLoadHours(controlLoad: unknown): number {
  if (
    !controlLoad ||
    typeof controlLoad !== "object" ||
    Array.isArray(controlLoad)
  ) {
    return 0;
  }
  return (
    Object.values(controlLoad as Record<string, unknown>) as unknown[]
  ).reduce<number>((acc, val) => acc + toNumberSafe(val), 0);
}

export function getRowHours(row: DisciplineContentRow) {
  const lectures = toNumberSafe(row.lectures);
  const seminars = toNumberSafe(row.seminars);
  const control = toNumberSafe(row.control);
  const independent = toNumberSafe(row.independent_work);
  const contact = lectures + seminars + control;
  const total = contact + independent;
  return { lectures, seminars, control, independent, contact, total };
}

export function normalizeStudyLoad(studyLoad: unknown): StudyLoad[] {
  if (!studyLoad) return [];

  if (Array.isArray(studyLoad)) {
    return studyLoad
      .map((item) => {
        const rec =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {};
        const name =
          getRecordValue(rec, "name") ??
          getRecordValue(rec, "type") ??
          getRecordValue(rec, "title");
        const id =
          getRecordValue(rec, "id") ??
          getRecordValue(rec, "hours") ??
          getRecordValue(rec, "value");
        return {
          name: name !== undefined ? String(name) : "",
          id: id !== undefined ? String(id) : "",
        };
      })
      .filter((x) => x.name || x.id);
  }

  if (typeof studyLoad === "object") {
    return Object.entries(studyLoad as Record<string, unknown>)
      .map(([name, val]) => {
        if (val && typeof val === "object") {
          const v = val as Record<string, unknown>;
          const hours =
            getRecordValue(v, "id") ??
            getRecordValue(v, "hours") ??
            getRecordValue(v, "value");
          return {
            name: String(name),
            id: hours !== undefined ? String(hours) : "",
          };
        }
        return { name: String(name), id: val !== undefined ? String(val) : "" };
      })
      .filter((x) => x.name || x.id);
  }

  return [];
}

export function calculateMaxHours(
  dataHours: StudyLoad[],
  controlLoadHours: number
) {
  if (!dataHours.length && !controlLoadHours) {
    return {
      maxHours: EMPTY_HOURS,
      hasBreakdownHours: false,
      hasMaxHours: false,
    };
  }

  if (!dataHours.length) {
    return {
      maxHours: {
        ...EMPTY_HOURS,
        all: controlLoadHours,
      },
      hasBreakdownHours: false,
      hasMaxHours: true,
    };
  }

  let sumAll = 0;
  const totals: number[] = [];
  let lectures = 0;
  let seminars = 0;
  let independent = 0;
  let controlFromStudy = 0;
  let hasBreakdown = false;

  for (const item of dataHours) {
    const hours = toNumberSafe(item.id);
    sumAll += hours;
    const category = getStudyLoadCategory(normalizeLabel(item.name));

    switch (category) {
      case "total":
        totals.push(hours);
        break;
      case "lectures":
        lectures += hours;
        hasBreakdown = true;
        break;
      case "seminars":
        seminars += hours;
        hasBreakdown = true;
        break;
      case "independent":
        independent += hours;
        hasBreakdown = true;
        break;
      case "control":
        controlFromStudy += hours;
        hasBreakdown = true;
        break;
      default:
        break;
    }
  }

  const totalsSum = totals.reduce((acc, val) => acc + val, 0);
  const breakdownTotal = lectures + seminars + independent + controlFromStudy;

  let all = 0;
  if (totals.length === 1) {
    all = totals[0];
  } else if (totals.length > 1) {
    all = breakdownTotal > 0 ? breakdownTotal : totalsSum;
  } else if (hasBreakdown) {
    all = breakdownTotal;
  } else {
    all = sumAll;
  }

  const fallbackControl = hasBreakdown
    ? Math.max(0, all - (lectures + seminars + independent))
    : 0;
  const control = Math.max(controlFromStudy, controlLoadHours, fallbackControl);

  if (!hasBreakdown) {
    return {
      maxHours: {
        ...EMPTY_HOURS,
        all: Number(all),
      },
      hasBreakdownHours: false,
      hasMaxHours: true,
    };
  }

  return {
    maxHours: {
      all: Number(all),
      lectures: Number(lectures),
      seminars: Number(seminars),
      control: Number(control),
      lect_and_sems: Number(lectures + seminars + control),
      independent_work: Number(independent),
    },
    hasBreakdownHours: true,
    hasMaxHours: true,
  };
}

export function getNextIdFromData(content: DisciplineContentData | undefined) {
  if (!content) return 0;
  const numericKeys = Object.keys(content)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n));
  const maxKey = numericKeys.length ? Math.max(...numericKeys) : -1;
  return maxKey + 1;
}

export function getInitialTableData(
  tableData: DisciplineContentData | undefined,
  storeData: DisciplineContentData | undefined
): DisciplineContentData {
  return (
    tableData ||
    storeData || {
      "0": {
        theme: "",
        lectures: 0,
        seminars: 0,
        independent_work: 0,
        competence: "",
        indicator: "",
        results: "",
      },
    }
  );
}

export function sumTableHours(
  data: DisciplineContentData | undefined
): ObjectHours {
  if (!data) return EMPTY_HOURS;

  let all = 0;
  let lectures = 0;
  let seminars = 0;
  let control = 0;
  let independent_work = 0;

  for (const row of Object.values(data)) {
    const rowHours = getRowHours(row);
    all += rowHours.total;
    lectures += rowHours.lectures;
    seminars += rowHours.seminars;
    control += rowHours.control;
    independent_work += rowHours.independent;
  }

  return {
    all,
    lectures,
    seminars,
    control,
    independent_work,
    lect_and_sems: lectures + seminars + control,
  };
}

export function isHoursEqual(a: ObjectHours, b: ObjectHours) {
  const keys = Object.keys(a) as (keyof ObjectHours)[];
  for (const key of keys) {
    if (toNumberSafe(a[key]) !== toNumberSafe(b[key])) return false;
  }
  return true;
}
