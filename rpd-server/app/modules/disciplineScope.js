const ZET_HOURS_DIVISOR = 36;

const TOTAL_LABELS = ["всего", "итого"];
const LECTURES_LABELS = ["лекц"];
const SEMINARS_LABELS = ["практич", "семинар", "лаб"];
const INDEPENDENT_LABELS = ["срс", "самостоят"];
const CONTROL_LABELS = ["контрол", "экзам", "зач", "аттест"];

function toNumberSafe(value) {
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

function normalizeLabel(value) {
  return String(value).trim().toLowerCase();
}

function includesAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function getStudyLoadCategory(label) {
  if (!label) return "unknown";
  if (includesAny(label, TOTAL_LABELS)) return "total";
  if (includesAny(label, LECTURES_LABELS)) return "lectures";
  if (includesAny(label, SEMINARS_LABELS)) return "seminars";
  if (includesAny(label, INDEPENDENT_LABELS)) return "independent";
  if (includesAny(label, CONTROL_LABELS)) return "control";
  return "unknown";
}

function getRecordValue(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

function normalizeStudyLoad(studyLoad) {
  if (!studyLoad) return [];

  if (Array.isArray(studyLoad)) {
    return studyLoad
      .map((item) => {
        const rec = item && typeof item === "object" ? item : {};
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
    return Object.entries(studyLoad)
      .map(([name, val]) => {
        if (val && typeof val === "object" && !Array.isArray(val)) {
          const hours =
            getRecordValue(val, "id") ??
            getRecordValue(val, "hours") ??
            getRecordValue(val, "value");
          return {
            name: String(name),
            id: hours !== undefined ? String(hours) : "",
          };
        }
        return {
          name: String(name),
          id: val !== undefined ? String(val) : "",
        };
      })
      .filter((x) => x.name || x.id);
  }

  return [];
}

function extractTotalAcademicHours(studyLoad) {
  const dataHours = normalizeStudyLoad(studyLoad);
  if (!dataHours.length) return null;

  let sumAll = 0;
  const totals = [];
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

  const breakdownTotal = lectures + seminars + independent + controlFromStudy;

  let all = 0;
  if (totals.length === 1) {
    all = totals[0];
  } else if (totals.length > 1) {
    all =
      breakdownTotal > 0 ? breakdownTotal : totals.reduce((a, v) => a + v, 0);
  } else if (hasBreakdown) {
    all = breakdownTotal;
  } else {
    all = sumAll;
  }

  return Number.isFinite(all) && all > 0 ? Number(all) : null;
}

function computeZetFromHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return Math.round(hours / ZET_HOURS_DIVISOR);
}

function resolveZetFromStudyLoad(studyLoad, fallbackZets) {
  const totalHours = extractTotalAcademicHours(studyLoad);
  const computedZet = computeZetFromHours(totalHours);
  if (computedZet !== null) return computedZet;

  const fallback = Number(fallbackZets);
  return Number.isFinite(fallback) ? fallback : null;
}

module.exports = {
  ZET_HOURS_DIVISOR,
  normalizeStudyLoad,
  extractTotalAcademicHours,
  computeZetFromHours,
  resolveZetFromStudyLoad,
};
