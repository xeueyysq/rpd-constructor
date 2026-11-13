import type { DocumentBlock } from "../../types/parser.ts";
import type { ContentItem } from "../../types/discipline.ts";
import { blocksToText } from "../utils/text.ts";
import { normalizeLine, normalizeText } from "../docx/normalize-text.ts";

function normalizeForSearch(s: string): string {
  return normalizeLine(s).toLowerCase();
}

export type ContentTableKind = "hours_table" | "section_description_table" | "unknown";

export type ContentParseMeta = {
  hadHoursTable: boolean;
  hadSectionDescriptionTable: boolean;
  contentMoreTextRuleBased: boolean;
};

export function detectContentTableKind(rowTexts: string[]): ContentTableKind {
  const joined = normalizeForSearch(rowTexts.join(" "));

  const hasHoursMarkers =
    joined.includes("всего") &&
    (joined.includes("академ") || joined.includes("час")) &&
    (joined.includes("лекц") ||
      joined.includes("практическ") ||
      joined.includes("лаборатор") ||
      joined.includes("самостоятельн"));

  if (hasHoursMarkers) {
    return "hours_table";
  }

  const hasSectionDescriptionMarkers =
    joined.includes("содержание раздела") &&
    (joined.includes("раздел 1") ||
      joined.includes("раздел 2") ||
      joined.includes("№") ||
      joined.includes("номер"));

  if (hasSectionDescriptionMarkers) {
    return "section_description_table";
  }

  return "unknown";
}

export function serializeSectionDescriptionTable(rows: string[][]): string | null {
  const lines: string[] = [];

  for (const row of rows) {
    const cleanCells = row.map((cell) => normalizeText(cell)).filter(Boolean);

    if (!cleanCells.length) {
      continue;
    }

    const rowText = cleanCells.join(" ").trim();

    if (!rowText) {
      continue;
    }

    const normalized = normalizeForSearch(rowText);
    const isHeader =
      normalized.includes("содержание раздела") ||
      normalized === "№" ||
      normalized === "номер";

    if (isHeader) {
      continue;
    }

    lines.push(rowText);
  }

  const result = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result || null;
}

export function extractContentMoreText(sectionText: string): string | null {
  if (!sectionText?.trim()) {
    return null;
  }

  const startMarkers = [
    /При\s+реализации\s+дисциплины/i,
    /Практическая\s+подготовка/i,
    /При\s+изучении\s+дисциплины/i,
    /В\s+ходе\s+изучения\s+курса/i,
  ];

  const stopMarkers = [
    /Перечень\s+учебно-методического\s+обеспечения/i,
    /Фонд\s+оценочных\s+средств/i,
    /Ресурсное\s+обеспечение/i,
    /Перечень\s+литературы/i,
  ];

  const startIndexes = startMarkers
    .map((regex) => {
      const match = sectionText.match(regex);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0);

  if (!startIndexes.length) {
    return null;
  }

  const start = Math.min(...startIndexes);
  const afterStart = sectionText.slice(start);

  const stopIndexes = stopMarkers
    .map((regex) => {
      const match = afterStart.match(regex);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0);

  const end = stopIndexes.length ? Math.min(...stopIndexes) : afterStart.length;

  const out = afterStart
    .slice(0, end)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out || null;
}

export function parseNullableNumberFromCell(
  cellText: string | null | undefined,
): number | null {
  if (!cellText) {
    return null;
  }

  const cleaned = cellText.replace(/\u00A0/g, " ").trim();

  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^-?\d+(?:[,.]\d+)?$/);
  if (!match) {
    return null;
  }

  const value = Number(cleaned.replace(",", "."));

  if (!Number.isFinite(value)) {
    return null;
  }
  if (value < 0) {
    return null;
  }

  return value;
}

type ColumnMap = {
  total: number;
  contact: number;
  lectures: number;
  practice: number;
  labs: number;
  independent: number;
};

const EMPTY_MAP: ColumnMap = {
  total: -1,
  contact: -1,
  lectures: -1,
  practice: -1,
  labs: -1,
  independent: -1,
};

function detectColumnMap(row: string[]): ColumnMap | null {
  const cells = row.map((c) => normalizeForSearch(c || ""));
  const m: ColumnMap = { ...EMPTY_MAP };
  let markers = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (!c.trim()) {
      continue;
    }
    if (c.includes("лаборатор") || (c.includes("лаб") && c.includes("занят"))) {
      m.labs = i;
      markers++;
    } else if (c.includes("практ")) {
      m.practice = i;
      markers++;
    } else if (c.includes("лекц")) {
      m.lectures = i;
      markers++;
    } else if (c.includes("контакт")) {
      m.contact = i;
      markers++;
    } else if (c.includes("самост") || c.includes("срс")) {
      m.independent = i;
      markers++;
    } else if (c.includes("всего")) {
      m.total = i;
      markers++;
    }
  }
  if (markers < 2) {
    return null;
  }
  return m;
}

const CONTENT_HEADER_MARKERS = [
  "наименование разделов",
  "всего",
  "академ",
  "час",
  "контактная работа",
  "лекции",
  "практические",
  "лабораторные",
  "самостоятельная",
  "тематическ",
  "№ п/п",
  "крп",
] as const;

function contentHeaderMarkerHits(text: string): number {
  const t = normalizeForSearch(text);
  return CONTENT_HEADER_MARKERS.filter((marker) => t.includes(marker)).length;
}

/** Строка таблицы целиком похожа на шапку «Наименование разделов / всего / …». */
function rowLooksLikeContentHeaderRow(row: string[], titleNorm: string): boolean {
  if (isContentHeaderRow(titleNorm)) {
    return true;
  }
  const joined = normalizeForSearch(row.join(" "));
  if (!joined.includes("наименование разделов")) {
    return false;
  }
  if (contentHeaderMarkerHits(joined) < 2) {
    return false;
  }
  return (
    joined.includes("всего") ||
    joined.includes("час") ||
    joined.includes("лекц") ||
    joined.includes("практ") ||
    joined.includes("самост") ||
    joined.includes("срс")
  );
}

function isContentHeaderRow(title: string): boolean {
  const t = normalizeForSearch(title);
  return CONTENT_HEADER_MARKERS.some((marker) => t.includes(marker));
}

/** План 10/11: служебная строка таблицы содержания по всей строке. */
const CONTENT_SERVICE_ROW_MARKERS = [
  "наименование разделов",
  "наименование тем",
  "всего",
  "академ",
  "контактная работа",
  "самостоятельная работа",
  "лекции",
  "практические",
  "лабораторные",
  "формы текущего контроля",
] as const;

export function fullRowLooksLikeContentServiceRow(row: string[]): boolean {
  const normalized = normalizeForSearch(row.join(" "));
  const hits = CONTENT_SERVICE_ROW_MARKERS.filter((m) => normalized.includes(m)).length;
  return hits >= 2;
}

function rowLooksLikeTableHeader(row: string[]): boolean {
  const joined = normalizeForSearch(row.join(" "));
  return (
    joined.includes("наименование") &&
    (joined.includes("всего") || joined.includes("час")) &&
    (joined.includes("лекц") || joined.includes("практ") || joined.includes("самост"))
  );
}

function isIntermediateAttestationPrep(title: string): boolean {
  const t = normalizeForSearch(title);
  return t.includes("подготовк") && t.includes("промежуточн") && t.includes("аттест");
}

function isSummaryRow(title: string): boolean {
  if (isIntermediateAttestationPrep(title)) {
    return false;
  }
  const t = normalizeForSearch(title);
  return (
    t.includes("итого") ||
    t.includes("промежуточная аттестация") ||
    t === "зачет" ||
    t === "экзамен"
  );
}

function isSectionDescriptionRow(title: string): boolean {
  return /^Раздел\s+\d+/i.test(title.trim());
}

function cellAt(row: string[], idx: number): number | null {
  if (idx < 0 || idx >= row.length) {
    return null;
  }
  return parseNullableNumberFromCell(row[idx]);
}

function mapRowWithColumnMap(
  row: string[],
  titleNorm: string,
  colMap: ColumnMap,
): ContentItem | null {
  const joined = row.join(" ");
  if (
    rowLooksLikeContentHeaderRow(row, titleNorm) ||
    fullRowLooksLikeContentServiceRow(row) ||
    isContentHeaderRow(titleNorm) ||
    isSummaryRow(titleNorm)
  ) {
    return null;
  }
  if (isSectionDescriptionRow(titleNorm)) {
    return {
      title: titleNorm,
      total_hours: null,
      lectures: null,
      practice: null,
      labs: null,
      independent_work: null,
      raw: [joined],
    };
  }

  const att = isIntermediateAttestationPrep(titleNorm);
  const total_hours = cellAt(row, colMap.total);
  const lectures = att ? null : cellAt(row, colMap.lectures);
  const practice = att ? null : cellAt(row, colMap.practice);
  const labs = att ? null : cellAt(row, colMap.labs);
  const independent_work = cellAt(row, colMap.independent);

  if (att) {
    return {
      title: titleNorm,
      total_hours,
      lectures: null,
      practice: null,
      labs: null,
      independent_work,
    };
  }

  if (titleNorm.match(/^Раздел\s+\d+$/i) && total_hours != null && total_hours <= 10) {
    const onlySectionNumber =
      colMap.total < 0 &&
      lectures == null &&
      practice == null &&
      labs == null &&
      independent_work == null;
    if (onlySectionNumber) {
      return {
        title: titleNorm,
        total_hours: null,
        lectures: null,
        practice: null,
        labs: null,
        independent_work: null,
        raw: [joined],
      };
    }
  }

  const item: ContentItem = {
    title: titleNorm,
    total_hours,
    lectures,
    practice,
    labs,
    independent_work,
  };
  const semM = joined.match(/(\d)\s*семестр/i);
  if (semM) {
    item.semester = Number.parseInt(semM[1]!, 10);
  }
  return item;
}

function mapRowFallback(row: string[], titleNorm: string): ContentItem | null {
  const joined = row.join(" ");
  if (
    rowLooksLikeContentHeaderRow(row, titleNorm) ||
    fullRowLooksLikeContentServiceRow(row) ||
    isContentHeaderRow(titleNorm) ||
    isSummaryRow(titleNorm)
  ) {
    return null;
  }
  if (isSectionDescriptionRow(titleNorm)) {
    return {
      title: titleNorm,
      total_hours: null,
      lectures: null,
      practice: null,
      labs: null,
      independent_work: null,
      raw: [joined],
    };
  }

  const att = isIntermediateAttestationPrep(titleNorm);
  if (att) {
    const nums = row
      .slice(1)
      .map((c) => parseNullableNumberFromCell(c))
      .filter((n): n is number => n !== null);
    if (nums.length >= 2) {
      return {
        title: titleNorm,
        total_hours: nums[0]!,
        lectures: null,
        practice: null,
        labs: null,
        independent_work: nums[nums.length - 1]!,
      };
    }
    if (nums.length === 1) {
      return {
        title: titleNorm,
        total_hours: nums[0]!,
        lectures: null,
        practice: null,
        labs: null,
        independent_work: nums[0]!,
      };
    }
    return {
      title: titleNorm,
      raw: [joined],
      total_hours: null,
      lectures: null,
      practice: null,
      labs: null,
      independent_work: null,
    };
  }

  const cells = row.slice(1).map((c) => parseNullableNumberFromCell(c));
  const definedCount = cells.filter((n) => n !== null).length;
  if (definedCount === 0) {
    const low = normalizeForSearch(joined);
    if (
      !low.includes("лекц") &&
      !low.includes("практ") &&
      !low.includes("лаб") &&
      /^Раздел\s*\d+/i.test(titleNorm)
    ) {
      return {
        title: titleNorm,
        raw: [joined],
        total_hours: null,
        lectures: null,
        practice: null,
        labs: null,
        independent_work: null,
      };
    }
    return null;
  }

  if (cells.length >= 6) {
    const total_hours = cells[0] ?? null;
    const lectures = cells[1] ?? null;
    const practice = cells[2] ?? null;
    const independent_work = cells[cells.length - 1] ?? null;
    const item: ContentItem = {
      title: titleNorm,
      total_hours,
      lectures,
      practice,
      labs: null,
      independent_work,
    };
    const semM = joined.match(/(\d)\s*семестр/i);
    if (semM) {
      item.semester = Number.parseInt(semM[1]!, 10);
    }
    return item;
  }

  if (cells.length === 5) {
    const item: ContentItem = {
      title: titleNorm,
      total_hours: cells[0] ?? null,
      lectures: cells[1] ?? null,
      practice: cells[2] ?? null,
      labs: null,
      independent_work: cells[4] ?? null,
    };
    const semM = joined.match(/(\d)\s*семестр/i);
    if (semM) {
      item.semester = Number.parseInt(semM[1]!, 10);
    }
    return item;
  }

  if (cells.length === 4) {
    const item: ContentItem = {
      title: titleNorm,
      total_hours: cells[0] ?? null,
      lectures: cells[1] ?? null,
      practice: cells[2] ?? null,
      labs: null,
      independent_work: cells[3] ?? null,
    };
    const semM = joined.match(/(\d)\s*семестр/i);
    if (semM) {
      item.semester = Number.parseInt(semM[1]!, 10);
    }
    return item;
  }

  return null;
}

function parseHoursTableRows(rows: string[][]): { content: Record<string, ContentItem> } {
  const content: Record<string, ContentItem> = {};
  let n = 1;
  let colMap: ColumnMap | null = null;
  for (const row of rows) {
    if (row.length < 2) {
      continue;
    }
    const headerMap = detectColumnMap(row);
    if (headerMap && rowLooksLikeTableHeader(row)) {
      colMap = headerMap;
      continue;
    }
    const title = row[0] || row[1] || "";
    const titleNorm = normalizeLine(title) || "—";
    const item = colMap
      ? mapRowWithColumnMap(row, titleNorm, colMap)
      : mapRowFallback(row, titleNorm);
    if (!item) {
      continue;
    }
    if (item.title && item.title !== "—" && (item.title.length > 2 || item.raw)) {
      content[String(n++)] = item;
    }
  }
  return { content };
}

export function parseContentSection(blocks: DocumentBlock[] | undefined): {
  content: Record<string, ContentItem>;
  content_more_text: string | null;
  content_template_more_text: string | null;
  meta: ContentParseMeta;
} {
  const meta: ContentParseMeta = {
    hadHoursTable: false,
    hadSectionDescriptionTable: false,
    contentMoreTextRuleBased: false,
  };

  if (!blocks?.length) {
    return {
      content: {},
      content_more_text: null,
      content_template_more_text: null,
      meta,
    };
  }

  const content: Record<string, ContentItem> = {};
  let n = 1;
  const templateParts: string[] = [];
  const REG = /Раздел\s*(\d+)/i;

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi]!;
    if (b.type === "table") {
      const rowTexts = b.rows.map((row) => row.join(" "));
      const kind = detectContentTableKind(rowTexts);

      if (kind === "section_description_table") {
        meta.hadSectionDescriptionTable = true;
        const titlePrefix: string[] = [];
        for (let back = 1; back <= 3 && bi - back >= 0; back++) {
          const prev = blocks[bi - back]!;
          if (
            prev.type === "paragraph" &&
            /содержание\s+дисциплины/i.test(prev.text) &&
            /очн|заочн/i.test(prev.text)
          ) {
            const line = normalizeLine(prev.text).trim();
            if (line) {
              titlePrefix.push(line);
            }
            break;
          }
        }
        const serialized = serializeSectionDescriptionTable(b.rows);
        const chunk = [...titlePrefix, serialized].filter(Boolean).join("\n\n");
        if (chunk) {
          templateParts.push(chunk);
        }
        continue;
      }

      if (kind === "unknown") {
        const parsed = parseHoursTableRows(b.rows);
        if (Object.keys(parsed.content).length > 0) {
          meta.hadHoursTable = true;
          for (const item of Object.values(parsed.content)) {
            content[String(n++)] = item;
          }
        }
        continue;
      }

      meta.hadHoursTable = true;
      const { content: rowsContent } = parseHoursTableRows(b.rows);
      for (const item of Object.values(rowsContent)) {
        content[String(n++)] = item;
      }
    } else {
      const t = b.text;
      if (REG.test(t) && t.trim() && !meta.hadSectionDescriptionTable) {
        templateParts.push(normalizeLine(t));
      }
    }
  }

  if (n === 1 && !meta.hadHoursTable) {
    const flat = blocksToText(blocks);
    const parts = flat.split(/\n{2,}/);
    for (const p of parts) {
      if (p.length < 4) {
        continue;
      }
      const m = p.match(/^\s*(\d+)[\s.)-]+(.+)/s);
      if (m) {
        content[String(n++)] = { title: normalizeLine(m[2] || p), raw: [p] };
      }
    }
  }

  const fullSectionText = blocksToText(blocks);
  let content_more_text = extractContentMoreText(fullSectionText);
  if (content_more_text) {
    meta.contentMoreTextRuleBased = true;
  } else {
    const extra: string[] = [];
    for (const b of blocks) {
      if (b.type !== "paragraph" || !b.text.trim()) {
        continue;
      }
      if (REG.test(b.text)) {
        if (!meta.hadSectionDescriptionTable) {
          templateParts.push(normalizeLine(b.text));
        }
        continue;
      }
      extra.push(b.text);
    }
    content_more_text = extra.length
      ? normalizeText(extra.join("\n\n").slice(0, 20000)) || null
      : null;
  }

  const content_template_more_text = templateParts.length
    ? normalizeText(templateParts.join("\n\n").slice(0, 15000)) || null
    : null;

  return {
    content,
    content_more_text,
    content_template_more_text,
    meta,
  };
}
