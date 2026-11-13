import type { DisciplineJson } from "../../types/discipline.ts";

export type ConfidenceMap = Record<string, number>;

/** Точное совпадение / явный паттерн */
export const HIGH = 0.92;
/** Найдено с допущениями */
export const MID = 0.78;
/** Нужна проверка */
export const LOW = 0.55;
/** Не найдено / эвристика */
export const VLOW = 0.25;
/** Пусто */
export const NONE = 0.08;

export function confidenceForString(
  value: string | null | undefined,
  how: "high" | "mid" | "low" = "high",
): number {
  if (value == null || value.trim() === "") {
    return NONE;
  }
  switch (how) {
    case "high":
      return HIGH;
    case "mid":
      return MID;
    case "low":
      return LOW;
  }
}

export function confidenceForArray(
  value: string[] | null | undefined,
  how: "high" | "mid" | "low" = "high",
): number {
  if (value == null || value.length === 0) {
    return NONE;
  }
  return how === "high" ? HIGH : how === "mid" ? MID : LOW;
}

export function confidenceForRecord(
  value: Record<string, unknown> | null | undefined,
  how: "high" | "mid" | "low" = "high",
): number {
  if (value == null || Object.keys(value).length === 0) {
    return NONE;
  }
  return how === "high" ? HIGH : how === "mid" ? MID : LOW;
}

export function mergeConfidence(base: ConfidenceMap, patch: Partial<ConfidenceMap>): ConfidenceMap {
  return { ...base, ...patch } as ConfidenceMap;
}

export function defaultConfidenceMap(json: DisciplineJson, partial: Partial<ConfidenceMap> = {}): ConfidenceMap {
  const keys: (keyof DisciplineJson)[] = [
    "disciplins_name",
    "department",
    "teacher",
    "goals",
    "place",
    "semester",
    "certification",
    "place_more_text",
    "competencies",
    "zet",
    "content",
    "content_more_text",
    "content_template_more_text",
    "methodological_support_template",
    "assessment_tools_template",
    "textbook",
    "additional_textbook",
    "professional_information_resources",
    "software",
    "faculty",
    "direction",
    "profile",
    "education_level",
    "education_form",
    "year",
  ];
  const out: ConfidenceMap = {};
  for (const k of keys) {
    out[k] = partial[k] ?? NONE;
  }
  return out;
}
