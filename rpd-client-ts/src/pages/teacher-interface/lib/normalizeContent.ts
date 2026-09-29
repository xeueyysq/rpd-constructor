import type { DisciplineContentData } from "../model/DisciplineContentPageTypes";

export function normalizeContent(data: DisciplineContentData | undefined) {
  return Object.fromEntries(
    Object.entries(data ?? {}).filter(
      ([, row]) =>
        row.theme ||
        row.lectures ||
        row.seminars ||
        row.control ||
        row.independent_work
    )
  ) as DisciplineContentData;
}
