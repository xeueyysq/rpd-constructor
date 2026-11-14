import { sameValue } from "@entities/template";
import type {
  DisciplineContentData,
  StudyPlanHours,
} from "../model/DisciplineContentPageTypes";
import { normalizeContent } from "./normalizeContent";

export const ATTESTATION_ROW_ID = "__attestation__";
export const editablePlanHours = [
  "all",
  "lectures",
  "seminars",
  "independent_work",
  "control",
] as const;
export type EditablePlanHour = (typeof editablePlanHours)[number];

export const emptyPlan: StudyPlanHours = {
  all: 0,
  lectures: 0,
  seminars: 0,
  contact: 0,
  independent_work: 0,
  control: 0,
  has_total: false,
  has_breakdown: false,
};

export function contentForDisplay(
  content: DisciplineContentData | undefined,
  attestationTheme: string,
  control: number
): DisciplineContentData {
  const rows = content ?? {
    "0": {
      theme: "",
      lectures: 0,
      seminars: 0,
      independent_work: 0,
      competence: "",
      indicator: "",
      results: "",
    },
  };
  const attestation: Partial<DisciplineContentData[string]> =
    rows[ATTESTATION_ROW_ID] ?? {};
  return {
    ...rows,
    [ATTESTATION_ROW_ID]: {
      lectures: 0,
      seminars: 0,
      control,
      independent_work: 0,
      competence: "",
      indicator: "",
      results: "",
      ...attestation,
      theme: attestationTheme,
    },
  };
}

// Автоматическая строка нужна для отображения, но сама по себе не является правкой.
export function contentForSave(
  draft: DisciplineContentData,
  initialDisplay: DisciplineContentData,
  baseline: DisciplineContentData
): DisciplineContentData {
  const content = { ...draft };
  if (
    sameValue(draft[ATTESTATION_ROW_ID], initialDisplay[ATTESTATION_ROW_ID])
  ) {
    if (baseline[ATTESTATION_ROW_ID])
      content[ATTESTATION_ROW_ID] = baseline[ATTESTATION_ROW_ID];
    else delete content[ATTESTATION_ROW_ID];
  }
  return normalizeContent(content);
}

export function changedPlanHours(
  plan: StudyPlanHours,
  baseline: StudyPlanHours
) {
  return Object.fromEntries(
    editablePlanHours
      .filter((key) => plan[key] !== baseline[key])
      .map((key) => [key, plan[key]])
  ) as Partial<Record<EditablePlanHour, number>>;
}

export function validContentDraft(
  content: DisciplineContentData,
  hours: Partial<Record<EditablePlanHour, number>>
) {
  const validHour = (value: unknown) => {
    if (value == null || value === "") return true;
    const number =
      typeof value === "number"
        ? value
        : Number(String(value).replace(/\s+/g, "").replace(",", "."));
    return Number.isFinite(number) && number >= 0;
  };
  return (
    Object.values(hours).every(validHour) &&
    Object.values(content).every((row) =>
      [row.lectures, row.seminars, row.independent_work, row.control].every(
        validHour
      )
    )
  );
}
