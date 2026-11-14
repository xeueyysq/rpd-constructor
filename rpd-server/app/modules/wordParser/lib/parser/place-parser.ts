import { blocksToText } from "../utils/text.ts";
import { normalizeLine, normalizeText } from "../docx/normalize-text.ts";
import type { DocumentBlock } from "../../types/parser.ts";

const HEADER = /Место дисциплины в структуре[^\n]*/i;

/** Блок «Перечень дисциплин…» для place_more_text (план 08). */
export function extractPrerequisiteDisciplinesText(sectionText: string): string | null {
  const marker =
    sectionText.match(/Перечень\s+дисциплин\s+с\s+указанием\s+разделов/i) ||
    sectionText.match(/Перечень\s+дисциплин/i);
  const match = marker;
  if (!match || match.index === undefined) {
    return null;
  }
  const text = sectionText.slice(match.index).trim();
  if (text.length < 20) {
    return null;
  }
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
/** «изучается в N семестре» и «изучается: в N…». */
const SEM =
  /(?:Дисциплина\s+)?изучается\s*(?::\s*)?в\s+(\d+)\s+семестр(?:е)?/i;

const SEM_FALLBACK = [
  /изучается[^.!\n]{0,120}?в\s+(\d+)\s+семестр(?:е)?/i,
  /изучается\s*:\s*в\s+(\d+)\s+семестр(?:е)?/i,
  /в\s+(\d+)[-–]?\s*(?:ом|м)?\s+семестре(?!\s*\d)/i,
  /во\s+(\d+)[-–]?\s*(?:ом|м)?\s+семестре(?!\s*\d)/i,
  /(\d+)[-–]?\s*м\s+семестр(?:е)?/i,
  /семестр\s*[:;]\s*(\d+)/i,
  /(\d+)\s+семестр\b/i,
];
const CERT_LINE = /форма\s+промежуточной\s+аттестации/i;

function removeSemesterCertificationSentence(text: string): string {
  return text
    .replace(
      /Дисциплина\s+изучается\s*:?\s*в\s+\d+\s+семестр(?:е)?[\s\S]*?аттестации\s*[–—-]\s*[^\n.]+/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function removeMainPlaceParagraph(sectionText: string, place: string | null): string {
  if (!place) {
    return sectionText;
  }
  let t = sectionText.split(place).join(" ");
  const n = normalizeLine(place);
  if (n !== place && n) {
    t = t.split(n).join(" ");
  }
  return t;
}

function firstMeaningfulParagraph(text: string): string {
  const parts = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (p.length < 3) {
      continue;
    }
    if (/^Место дисциплины в структуре/i.test(p)) {
      continue;
    }
    if (SEM.test(p) || CERT_LINE.test(p)) {
      continue;
    }
    return p;
  }
  return parts[0] || "";
}

function buildPlaceMoreText(
  sectionText: string,
  place: string | null,
  semesterMatch: RegExpMatchArray | null,
  certMatch: RegExpMatchArray | null,
): string | null {
  let t = sectionText;
  t = removeMainPlaceParagraph(t, place);
  t = removeSemesterCertificationSentence(t);
  if (semesterMatch) {
    t = t.replace(semesterMatch[0], " ");
  }
  if (certMatch) {
    t = t.replace(certMatch[0], " ");
  }
  t = t.replace(HEADER, " ");
  t = normalizeText(t);
  const cleaned = t
    .replace(/Место дисциплины в структуре ОПОП ВО/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) {
    return null;
  }
  if (cleaned.length < 12) {
    return null;
  }
  if (/^Дисциплина\s+[а-яё]?\s*очной формы обучения/i.test(cleaned)) {
    return null;
  }
  if (/^Дисциплина\s+е\s+очной/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function parsePlaceSection(blocks: DocumentBlock[] | undefined): {
  place: string | null;
  semester: number | null;
  certification: string | null;
  place_more_text: string | null;
} {
  if (!blocks?.length) {
    return { place: null, semester: null, certification: null, place_more_text: null };
  }
  const full = normalizeText(blocksToText(blocks));

  let sm = full.match(SEM);
  if (!sm) {
    for (const rx of SEM_FALLBACK) {
      const m = full.match(rx);
      if (m) {
        sm = m;
        break;
      }
    }
  }
  const semester = sm ? Number.parseInt(sm[1]!, 10) : null;

  let certification: string | null = null;
  let cm: RegExpMatchArray | null = full.match(
    /форма\s+промежуточной\s+аттестации\s*[–—:]\s*([а-яА-ЯёЁ\s-]+?)(?=\n|$|\.|;)/i,
  );
  if (cm) {
    certification = cm[1]!.replace(/\s+/g, " ").trim().toLowerCase();
  } else {
    const cm2 = full.match(
      /промежуточная\s+аттестация\s*:\s*([а-яА-ЯёЁ\s-]+?)(?=\n|$|\.|;)/i,
    );
    if (cm2) {
      cm = cm2;
      certification = cm2[1]!.replace(/\s+/g, " ").trim().toLowerCase();
    } else {
      const cm3 =
        /(?:аттестац|промежуточн|форма\s+контроля)[^.]{0,120}?(зач[её]т|экзамен|дифференцированн[^\n.]{0,40}зач[её]т)/i.exec(
          full,
        );
      if (cm3) {
        cm = cm3;
        certification = cm3[1]!.replace(/\s+/g, " ").trim().toLowerCase();
      }
    }
  }

  const placeRaw = firstMeaningfulParagraph(full) || "";
  const place = placeRaw ? normalizeLine(placeRaw) : null;

  const fromPrereq = extractPrerequisiteDisciplinesText(full);
  const place_more_text = fromPrereq ?? buildPlaceMoreText(full, place, sm, cm);

  return { place, semester, certification, place_more_text };
}
