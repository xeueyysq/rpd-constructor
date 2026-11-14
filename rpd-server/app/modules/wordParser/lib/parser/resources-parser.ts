import { blocksToText } from "../utils/text.ts";
import { normalizeLine, normalizeText } from "../docx/normalize-text.ts";
import type { DocumentBlock } from "../../types/parser.ts";

/** Начало блока основной литературы (batch3: альтернативные заголовки). */
const MAIN_HEADER_SKIP =
  /основная литература|перечень основной литературы|список основной литературы|рекомендуемая литература|учебная литература|учебно-методическое обеспечение|информационное обеспечение дисциплины/i;
const MAIN_START_HEADINGS = [
  "Основная литература",
  "Перечень основной литературы",
  "Список основной литературы",
  "Рекомендуемая литература",
  "Учебная литература",
  "Учебно-методическое обеспечение",
  "Информационное обеспечение дисциплины",
];
const ADD = /Дополнительная литература/i;
const PRO_DB = /Профессиональные базы данных|информационные справочные системы/i;
const PRO_NET = /Профессиональные ресурсы сети|Профессиональные ресурсы/i;
const ELIB = /Электронно-библиотечные системы/i;
const SOFT_START = /Необходимое программное обеспечение/i;
const SOFT_END = /Необходимое материально-техническое|материально-техническое обеспечение/i;
const PRO_ANY = /профессиональн(ые)?\s+баз|электронн(ые)?\s+библиотек|ресурсн/i;

function normalizeForSearchLine(line: string): string {
  return normalizeLine(line).toLowerCase().replace(/\s+/g, " ");
}

export function isGarbageResourceLine(line: string): boolean {
  const value = normalizeText(line).trim();
  const search = normalizeForSearchLine(value);

  if (!value) {
    return true;
  }
  if (value.length < 8 && !/https?:\/\//i.test(value)) {
    return true;
  }

  const garbage = [
    "и базы данных",
    "ресурсное обеспечение",
    "профессиональные базы данных",
    "информационные справочные системы",
    "электронно библиотечные системы и базы данных",
    "профессиональные ресурсы сети интернет",
  ];

  return garbage.some((item) => search === item || search.includes(item));
}

export function splitNumberedItems(text: string): string[] {
  return text
    .replace(/(?<=\s)(?=\d+(?:https?:|[А-ЯЁA-ZА-яё]))/gi, "\n")
    .replace(/(?<=[^\s])(?=\d+\s*[А-ЯЁA-ZА-яё])/g, "\n")
    .replace(/(?<=[./])(?=\d+https?:\/\/)/gi, "\n")
    .replace(/^(\d+)(?=[А-ЯЁA-ZА-яё])/gm, "$1 ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeNumberedResource(line: string): string {
  return line
    .replace(/^(\d+)(?=\S)/, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Убирает маркер списка «1 …» для согласования с эталоном JSON. */
function stripLeadingEnumeration(line: string): string {
  return line.replace(/^\d+\s+/, "").trim();
}

function findFirstHeadingIndex(text: string, headings: string[]): number {
  let best = -1;
  for (const h of headings) {
    const i = text.toLowerCase().indexOf(h.toLowerCase());
    if (i >= 0 && (best < 0 || i < best)) {
      best = i;
    }
  }
  return best;
}

function extractBetweenHeadings(
  text: string,
  startHeadings: string[],
  stopHeadings: string[],
): string | null {
  const startIndex = findFirstHeadingIndex(text, startHeadings);
  if (startIndex < 0) {
    return null;
  }
  const fromStart = text.slice(startIndex);
  let cut = fromStart.length;
  const low = fromStart.toLowerCase();
  for (const stop of stopHeadings) {
    const idx = low.indexOf(stop.toLowerCase(), 12);
    if (idx > 0) {
      cut = Math.min(cut, idx);
    }
  }
  return fromStart.slice(0, cut).trim();
}

function isResourceHeading(line: string): boolean {
  const t = normalizeForSearchLine(line);
  return [
    "перечень литературы",
    "основная литература",
    "дополнительная литература",
    "профессиональные базы данных",
    "информационные справочные системы",
    "электронно библиотечные",
    "профессиональные ресурсы сети",
    "ресурсное обеспечение",
    "необходимое программное обеспечение",
    "необходимое материально",
  ].some((heading) => t.includes(heading));
}

function linesFromPart(part: string, skipHeader: RegExp): string[] {
  return part
    .split(/\n+/)
    .map((l) => normalizeLine(l))
    .filter((l) => l.length > 2 && !skipHeader.test(l));
}

export function parseResourceBlocks(blocks: DocumentBlock[] | undefined): {
  textbook: string[] | null;
  additional_textbook: string[] | null;
  professional_information_resources: string[] | null;
  software: string | null;
} {
  if (!blocks?.length) {
    return {
      textbook: null,
      additional_textbook: null,
      professional_information_resources: null,
      software: null,
    };
  }
  const text = blocksToText(blocks);

  const mainIdx = findFirstHeadingIndex(text, MAIN_START_HEADINGS);
  const addIdx = text.search(ADD);
  let textbook: string[] = [];
  if (mainIdx >= 0) {
    const end = addIdx > mainIdx ? addIdx : text.length;
    textbook = linesFromPart(text.slice(mainIdx, end), MAIN_HEADER_SKIP);
  }

  let additional: string[] = [];
  const addBlock = extractBetweenHeadings(
    text,
    ["Дополнительная литература"],
    [
      "Профессиональные базы данных и информационные справочные системы",
      "Профессиональные базы данных",
      "Профессиональные ресурсы сети",
      "Электронно-библиотечные системы",
      "Необходимое программное обеспечение",
    ],
  );
  if (addBlock) {
    additional = linesFromPart(
      addBlock.replace(/^[\s\S]*?Дополнительная литература/i, ""),
      ADD,
    ).filter((l) => !isResourceHeading(l));
  } else if (addIdx >= 0) {
    const profI = text.search(PRO_DB);
    const elibI = text.search(ELIB);
    const netI = text.search(PRO_NET);
    const softI = text.search(SOFT_START);
    const candidates = [profI, elibI, netI].filter((i) => i > addIdx);
    const end = candidates.length ? Math.min(...candidates) : softI > addIdx ? softI : text.length;
    additional = linesFromPart(text.slice(addIdx, end), ADD).filter((l) => !isResourceHeading(l));
  }

  const prof: string[] = [];
  const profBlock = extractBetweenHeadings(
    text,
    [
      "Профессиональные базы данных и информационные справочные системы",
      "Профессиональные базы данных",
      "Электронно-библиотечные системы и базы данных",
    ],
    ["Необходимое программное обеспечение", "Необходимое материально"],
  );
  if (profBlock) {
    const body = profBlock
      .replace(/^[\s\S]*?(?=Профессиональные|Электронно)/i, "")
      .replace(PRO_DB, "")
      .replace(ELIB, "");
    const lines = splitNumberedItems(body)
      .flatMap((chunk) => linesFromPart(chunk, /^(Профессиональн|Электронно)/i))
      .map((l) => stripLeadingEnumeration(normalizeNumberedResource(l)))
      .filter((l) => l.length > 4 && !isResourceHeading(l) && !isGarbageResourceLine(l));
    prof.push(...lines);
  }
  if (prof.length === 0) {
    const p1 = text.match(
      new RegExp(
        `(${PRO_DB.source}|${PRO_NET.source}|${ELIB.source})[\\s\\S]*?(?=\\n\\nНеобходимое|Необходимое программ|$)`,
        "i",
      ),
    );
    if (p1?.[0]) {
      prof.push(
        ...splitNumberedItems(p1[0])
          .map((l) => stripLeadingEnumeration(normalizeNumberedResource(normalizeLine(l))))
          .filter((l) => l.length > 4 && !isResourceHeading(l) && !isGarbageResourceLine(l)),
      );
    }
  }
  if (prof.length === 0) {
    const p2 = Math.max(text.search(PRO_DB), text.search(PRO_NET), text.search(ELIB));
    if (p2 >= 0) {
      const softAt = text.search(SOFT_START);
      const rest = text.slice(p2, softAt > p2 ? softAt : text.length);
      prof.push(
        ...linesFromPart(rest, PRO_ANY)
          .map((l) => stripLeadingEnumeration(normalizeNumberedResource(l)))
          .filter((l) => l.length > 4 && !isResourceHeading(l) && !isGarbageResourceLine(l)),
      );
    }
  }

  const si = text.search(SOFT_START);
  let software: string | null = null;
  if (si >= 0) {
    const rest = text.slice(si);
    const ei = rest.search(SOFT_END);
    const chunk = ei > 0 ? rest.slice(0, ei) : rest;
    software = normalizeText(chunk.replace(SOFT_START, "")) || null;
  }

  return {
    textbook: textbook.length ? textbook : null,
    additional_textbook: additional.length ? additional : null,
    professional_information_resources: prof.length ? prof : null,
    software,
  };
}
