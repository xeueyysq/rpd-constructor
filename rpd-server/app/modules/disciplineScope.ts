const ZET_HOURS_DIVISOR = 36;

const LABELS = {
  all: ["всего", "итого"],
  lectures: ["лекц"],
  seminars: ["практи", "семинар", "лаб"],
  control: ["контрол", "экзам", "зач", "аттест"],
  independent_work: ["срс", "самостоят"],
} as const;
type HourCategory = keyof typeof LABELS;
type HoursPatch = Partial<Record<HourCategory, number>>;
const CANONICAL_LABELS: Record<HourCategory, string> = {
  all: "Всего",
  lectures: "Лекции",
  seminars: "Практические",
  control: "Контроль",
  independent_work: "СРС",
};

function parseHours(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = parseFloat(normalized);
  return Number.isFinite(fallback) ? fallback : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function categoryOf(label: unknown): HourCategory | null {
  const normalized = String(label ?? "").trim().toLowerCase();
  for (const [category, needles] of Object.entries(LABELS)) {
    if (needles.some((needle) => normalized.includes(needle))) return category as HourCategory;
  }
  return null;
}

function entriesOf(studyLoad: unknown): { name: string; value: unknown }[] {
  if (Array.isArray(studyLoad)) {
    return studyLoad.filter(isRecord).map((item) => ({
      name: String(item.name ?? item.type ?? item.title ?? ""),
      value: item.id ?? item.hours ?? item.value,
    }));
  }
  if (isRecord(studyLoad)) {
    return Object.entries(studyLoad).map(([name, value]) => ({
      name,
      value: isRecord(value) ? value.id ?? value.hours ?? value.value : value,
    }));
  }
  return [];
}

function normalizeStudyLoad(studyLoad: unknown) {
  return entriesOf(studyLoad)
    .map(({ name, value }) => ({ name, id: value === undefined ? "" : String(value) }))
    .filter(({ name, id }) => name || id);
}

function getStudyPlanHours(studyLoad: unknown, controlLoad: unknown) {
  const sums = { lectures: 0, seminars: 0, control: 0, independent_work: 0 };
  const totals: number[] = [];
  let hasBreakdown = false;
  let hasStudyControl = false;
  for (const entry of entriesOf(studyLoad)) {
    const category = categoryOf(entry.name);
    if (category === "all") totals.push(parseHours(entry.value));
    else if (category) {
      sums[category] += parseHours(entry.value);
      hasBreakdown = true;
      if (category === "control") hasStudyControl = true;
    }
  }
  if (!hasStudyControl) {
    sums.control = entriesOf(controlLoad).reduce((sum, entry) => sum + parseHours(entry.value), 0);
  }
  const contact = sums.lectures + sums.seminars;
  const breakdownTotal = contact + sums.control + sums.independent_work;
  const all = totals.length === 1 ? totals[0]
    : totals.length > 1 ? (breakdownTotal > 0 ? breakdownTotal : totals.reduce((sum, value) => sum + value, 0))
    : hasBreakdown || sums.control > 0 ? breakdownTotal : 0;
  return { all, ...sums, contact, has_total: totals.length > 0 || hasBreakdown, has_breakdown: hasBreakdown };
}

function replaceValue(previous: unknown, next: number) {
  return typeof previous === "string" ? String(next) : next;
}

function patchStudyLoad(studyLoad: unknown, hours: HoursPatch) {
  const categories = Object.keys(hours) as HourCategory[];
  if (Array.isArray(studyLoad) && studyLoad.length) {
    const seen = new Set<HourCategory>();
    const result = studyLoad.flatMap((item: unknown) => {
      if (!isRecord(item)) return [item];
      const category = categoryOf(item.name ?? item.type ?? item.title);
      if (!category || !Object.hasOwn(hours, category)) return [item];
      if (seen.has(category)) return [];
      seen.add(category);
      const valueKey = ["id", "hours", "value"].find((key) => Object.hasOwn(item, key)) ?? "id";
      return [{ ...item, [valueKey]: replaceValue(item[valueKey], hours[category]!) }];
    });
    for (const category of categories) {
      if (!seen.has(category)) result.push({ name: CANONICAL_LABELS[category], id: hours[category] });
    }
    return result;
  }
  if (isRecord(studyLoad) && Object.keys(studyLoad).length) {
    const seen = new Set<HourCategory>();
    const result: Record<string, unknown> = {};
    for (const [label, value] of Object.entries(studyLoad)) {
      const category = categoryOf(label);
      if (!category || !Object.hasOwn(hours, category)) { result[label] = value; continue; }
      if (seen.has(category)) continue;
      seen.add(category);
      if (isRecord(value)) {
        const valueKey = ["id", "hours", "value"].find((key) => Object.hasOwn(value, key)) ?? "id";
        result[label] = { ...value, [valueKey]: replaceValue(value[valueKey], hours[category]!) };
      } else result[label] = replaceValue(value, hours[category]!);
    }
    for (const category of categories) {
      if (!seen.has(category)) result[CANONICAL_LABELS[category]] = hours[category];
    }
    return result;
  }
  return categories.map((category) => ({ name: CANONICAL_LABELS[category], id: hours[category] }));
}

function getContentRowHours(row: unknown) {
  const value = isRecord(row) ? row : {};
  const lectures = parseHours(value.lectures);
  const seminars = parseHours(value.seminars);
  const control = parseHours(value.control);
  const independent_work = parseHours(value.independent_work);
  const contact = lectures + seminars;
  return { lectures, seminars, contact, control, independent_work, total: contact + control + independent_work };
}

function sumContentHours(content: unknown) {
  const values = Array.isArray(content) ? content : isRecord(content) ? Object.values(content) : [];
  return values.reduce<ReturnType<typeof getContentRowHours>>((sum, row) => {
    const hours = getContentRowHours(row);
    return { lectures: sum.lectures + hours.lectures, seminars: sum.seminars + hours.seminars,
      contact: sum.contact + hours.contact, control: sum.control + hours.control,
      independent_work: sum.independent_work + hours.independent_work, total: sum.total + hours.total };
  }, getContentRowHours(null));
}

function extractTotalAcademicHours(studyLoad: unknown) {
  const hours = getStudyPlanHours(studyLoad, null);
  const fallback = entriesOf(studyLoad).reduce((sum, entry) => sum + parseHours(entry.value), 0);
  const total = hours.has_total ? hours.all : fallback;
  return total > 0 ? total : null;
}

function computeZetFromHours(hours: number | null) {
  if (hours === null || !Number.isFinite(hours) || hours <= 0) return null;
  return Math.round(hours / ZET_HOURS_DIVISOR);
}

function resolveZetFromStudyLoad(studyLoad: unknown, fallbackZets: unknown) {
  const computedZet = computeZetFromHours(extractTotalAcademicHours(studyLoad));
  if (computedZet !== null) return computedZet;
  const fallback = Number(fallbackZets);
  return Number.isFinite(fallback) ? fallback : null;
}

export { ZET_HOURS_DIVISOR, parseHours, normalizeStudyLoad, getStudyPlanHours, patchStudyLoad,
  getContentRowHours, sumContentHours, extractTotalAcademicHours, computeZetFromHours, resolveZetFromStudyLoad };
