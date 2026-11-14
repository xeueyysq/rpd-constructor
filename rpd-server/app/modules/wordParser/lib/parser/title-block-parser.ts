import { cleanDepartment, normalizeLine, normalizeText } from "../docx/normalize-text.ts";
import type { DocumentBlock } from "../../types/parser.ts";
import { parseYearFromText } from "../utils/text.ts";

const WORK_PRG = /Рабочая программа дисциплины/i;

function normalizeForDisciplineTitleSearch(value: string): string {
  return normalizeLine(value).toLowerCase().replace(/\s+/g, " ").trim();
}

const DISCIPLINE_TITLE_BLACKLIST = [
  "направление подготовки",
  "профиль",
  "уровень высшего образования",
  "форма обучения",
  "кафедра",
  "институт",
  "рабочая программа дисциплины",
  "федеральное государственное бюджетное образовательное учреждение",
  "университет дубна",
  "г. дубна",
  "дубна",
  "автор программы",
  "согласовано",
  "программа рассмотрена",
];

const BAD_TITLE_LINE_PATTERNS = [
  /^\d{2}\.\d{2}\.\d{2}/,
  /^20\d{2}\s*г?\.?$/i,
  /^форма обучения/i,
  /^профиль$/i,
  /^направление подготовки/i,
];

const FILENAME_TITLE_BLACKLIST = /^(document|рпд|программа|модуль|\d{4})$/i;

/**
 * План 11: черновое имя дисциплины из имени файла (CamelCase → пробелы).
 * Не использовать без RPD-marker check и без acceptDisciplineTitle.
 */
export function guessDisciplineNameFromFileName(fileName: string): string | null {
  const base = fileName
    .replace(/\.docx$/i, "")
    .replace(/_ИВТ.*$/i, "")
    .replace(/_.*$/g, "")
    .trim();

  if (!base || base.length < 3) {
    return null;
  }

  const withSpaces = base
    .replace(/([а-яё])([А-ЯЁ])/g, "$1 $2")
    .replace(/([A-Za-z])([А-ЯЁ])/g, "$1 $2")
    .replace(/([а-яё])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!withSpaces || FILENAME_TITLE_BLACKLIST.test(withSpaces)) {
    return null;
  }
  return withSpaces;
}

/** План 09: не принимать служебные строки за название дисциплины. */
export function isBadDisciplineTitleCandidate(value: string): boolean {
  const normalized = normalizeForDisciplineTitleSearch(value);
  if (!normalized) {
    return true;
  }
  const raw = normalizeLine(value).trim();
  if (BAD_TITLE_LINE_PATTERNS.some((re) => re.test(raw))) {
    return true;
  }
  return DISCIPLINE_TITLE_BLACKLIST.some(
    (item) => normalized === item || normalized.includes(item),
  );
}

function acceptDisciplineTitle(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const n = normalizeLine(value);
  if (isBadDisciplineTitleCandidate(n)) {
    return null;
  }
  return n;
}

/** Если название не на отдельной строке: кавычки в одном абзаце или первая содержательная строка после заголовка. */
function guessDisciplineLineAfterWorkProgram(lines: string[]): string | null {
  const skip =
    /^(кафедра|институт|направление|федеральн|утвержден|содержан|приложен|лист\s+утвержд|рабочая программа|форма обучения|уровень высшего)/i;
  let after = false;
  for (const line of lines) {
    if (WORK_PRG.test(line)) {
      after = true;
      const tail = line.replace(WORK_PRG, "").replace(/^[\s:«"–-]+/i, "").trim();
      const unquoted = tail.replace(/^[«"]([^»"]+)[»"]\s*$/, "$1").trim();
      const cand = acceptDisciplineTitle(unquoted);
      if (unquoted.length >= 8 && !skip.test(unquoted) && cand) {
        return cand;
      }
      continue;
    }
    if (!after) {
      continue;
    }
    const t = line.trim();
    if (t.length < 12 || t.length > 300) {
      continue;
    }
    if (skip.test(t)) {
      continue;
    }
    if (/^\d[\d\s.)-]*$/.test(t)) {
      continue;
    }
    if (t.split(/\s+/).length >= 2 && /[а-яё]{4,}/i.test(t)) {
      const cand = acceptDisciplineTitle(t);
      if (cand) {
        return cand;
      }
    }
  }
  return null;
}

/** План 10: самая содержательная строка между «Рабочая программа…» и «Направление подготовки». */
function titleBetweenWorkProgramAndDirection(lines: string[]): string | null {
  let iWork = -1;
  let iDir = -1;
  for (let i = 0; i < lines.length; i++) {
    if (WORK_PRG.test(lines[i]!) && iWork < 0) {
      iWork = i;
    }
    if (/направление\s+подготовки/i.test(lines[i]!) && iDir < 0) {
      iDir = i;
    }
  }
  if (iWork < 0 || iDir < 0 || iDir <= iWork + 1) {
    return null;
  }
  const candidates: string[] = [];
  for (let j = iWork + 1; j < iDir; j++) {
    const t = lines[j]!.trim();
    if (t.length < 6 || t.length > 280) {
      continue;
    }
    const cand = acceptDisciplineTitle(t);
    if (cand && t.split(/\s+/).length >= 2 && /[а-яёa-z]{3,}/i.test(t)) {
      candidates.push(cand);
    }
  }
  if (!candidates.length) {
    return null;
  }
  return candidates.reduce((a, b) => (a.length >= b.length ? a : b));
}

/** Название в ячейке таблицы титула в одной строке с «Рабочая программа…». */
function titleFromTitleTable(blocks: DocumentBlock[]): string | null {
  for (const b of blocks) {
    if (b.type !== "table") {
      continue;
    }
    for (const row of b.rows) {
      const joined = row.join(" ");
      if (!WORK_PRG.test(joined)) {
        continue;
      }
      for (const cell of row) {
        const t = cell?.trim() ?? "";
        if (!t || t.length < 6 || WORK_PRG.test(t)) {
          continue;
        }
        const cand = acceptDisciplineTitle(t);
        if (cand) {
          return cand;
        }
      }
    }
  }
  return null;
}

function linesFromPreSection(blocks: DocumentBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph" && b.text.trim()) {
      out.push(b.text);
    } else if (b.type === "table") {
      for (const row of b.rows) {
        const line = row.filter((c) => c.trim()).join(" ");
        if (line.trim()) {
          out.push(line);
        }
      }
    }
  }
  return out;
}

function findAfterLine(lines: string[], re: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (t) {
          const cand = acceptDisciplineTitle(t);
          if (cand) {
            return cand;
          }
        }
      }
    }
  }
  return null;
}

function findLineStartingWith(
  lines: string[],
  prefix: string,
  alt?: RegExp,
): string | null {
  for (const line of lines) {
    const t = line.trim();
    if (t.toLowerCase().startsWith(prefix.toLowerCase()) || (alt && alt.test(t))) {
      return normalizeLine(t);
    }
  }
  return null;
}

function findAfterLabel(lines: string[], label: RegExp): string | null {
  for (const line of lines) {
    const t = line.trim();
    if (label.test(t)) {
      const rest = t.replace(label, "").replace(/^[:\s–-]+/i, "").trim();
      if (rest) {
        return normalizeLine(rest);
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (label.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (t && t.length < 200) {
          return normalizeLine(t);
        }
      }
    }
  }
  return null;
}

const DEGREES = /(доктор|кандидат|профессор|доцент|ст\.\s*преподавател|старший преподаватель|ассистент|зав\.\s*кафедр)/gi;
const KAF = /^кафедр/i;
const TRAIL_JUNK = /,\s*(подпись|дата|___).*$/i;

function extractTeacher(authorBlock: string): string | null {
  let s = authorBlock
    .replace(/\/\s*_{2,}\s*\/?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(TRAIL_JUNK, "").trim();
  s = s.replace(DEGREES, "").replace(/,+/g, ",").replace(/^,\s*/, "").trim();
  if (KAF.test(s)) {
    s = s.replace(/^[^,]+,\s*/i, "").trim();
  }
  // Фамилия с инициалами: слово с заглавной + И.О.
  const fio = s.match(
    /([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.[А-ЯЁ]\.)|(?:[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]\.))/,
  );
  if (fio) {
    return fio[1].trim();
  }
  const short = s.match(/([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ]\.[А-ЯЁ])?)/);
  return short ? short[1] : s.length < 2 ? null : s.slice(0, 120);
}

export type TitleBlockResult = {
  disciplins_name: string | null;
  faculty: string | null;
  department: string | null;
  direction: string | null;
  profile: string | null;
  education_level: string | null;
  education_form: string | null;
  year: number | null;
  teacher: string | null;
  raw: string;
};

export type ParseTitleBlockOptions = {
  /** Имя исходного .docx (fallback названия). */
  sourceFileName?: string;
  /** Только если документ уже прошёл проверку маркеров РПД. */
  allowFileNameFallback?: boolean;
};

export function parseTitleBlock(
  preSection: DocumentBlock[],
  options?: ParseTitleBlockOptions,
): TitleBlockResult {
  const text = preSection
    .map((b) =>
      b.type === "paragraph"
        ? b.text
        : b.rows.map((r) => r.join(" ")).join("\n"),
    )
    .join("\n");
  const raw = normalizeText(text);
  const lines = linesFromPreSection(preSection);

  let disciplins_name: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    if (WORK_PRG.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (t && t.length < 500 && !/^кафедра/i.test(t) && !/^институт/i.test(t)) {
          const cand = acceptDisciplineTitle(t);
          if (cand) {
            disciplins_name = cand;
            break;
          }
        }
      }
      if (disciplins_name) {
        break;
      }
    }
  }
  if (!disciplins_name) {
    disciplins_name = findAfterLine(lines, WORK_PRG);
  }
  if (!disciplins_name) {
    const mQuoted = raw.match(
      /Рабочая\s+программа\s+дисциплины\s*[«"]([^»"]{3,250})[»"]/iu,
    );
    const fromQuote = mQuoted?.[1]?.trim() ? acceptDisciplineTitle(mQuoted[1].trim()) : null;
    if (fromQuote) {
      disciplins_name = fromQuote;
    }
  }
  if (!disciplins_name) {
    disciplins_name = titleFromTitleTable(preSection);
  }
  if (!disciplins_name) {
    disciplins_name = titleBetweenWorkProgramAndDirection(lines);
  }
  if (!disciplins_name) {
    disciplins_name = guessDisciplineLineAfterWorkProgram(lines);
  }
  if (!disciplins_name && options?.allowFileNameFallback && options.sourceFileName) {
    const fromFn = guessDisciplineNameFromFileName(options.sourceFileName);
    if (fromFn && acceptDisciplineTitle(fromFn)) {
      disciplins_name = fromFn;
    }
  }

  let faculty: string | null = null;
  for (const line of lines) {
    const t = line.trim();
    if (/^Институт/i.test(t) || /^[«"]?Институт/i.test(t)) {
      faculty = normalizeLine(t);
      break;
    }
  }

  const department = cleanDepartment(
    findLineStartingWith(lines, "кафедра", /^Кафедра/i) || null,
  );

  let direction: string | null = findAfterLabel(lines, /Направление подготовки/i);
  if (direction && !/\d{2}\.\d{2}\.\d{2}/.test(direction)) {
    for (const line of lines) {
      if (/\d{2}\.\d{2}\.\d{2}/.test(line)) {
        direction = normalizeLine(line);
        break;
      }
    }
  }
  if (!direction) {
    for (const line of lines) {
      if (/\d{2}\.\d{2}\.\d{2}/.test(line) && /информатик|подготовк|направлен/i.test(line)) {
        direction = normalizeLine(line);
        break;
      }
    }
  }
  if (!direction) {
    for (const line of lines) {
      if (/\d{2}\.\d{2}\.\d{2}/.test(line)) {
        direction = normalizeLine(line);
        break;
      }
    }
  }

  const profile = findAfterLabel(lines, /Профиль/i);
  const education_level = findAfterLabel(lines, /Уровень высшего образования/i);
  const education_form = findAfterLabel(lines, /Форма обучения/i);

  const year = parseYearFromText(raw) ?? parseYearFromText(lines.join("\n"));

  let teacher: string | null = null;
  for (const line of lines) {
    if (/Автор\(?ы\)?\s*программы/i.test(line)) {
      const same = line.replace(/Автор\(?ы\)?\s*программы:?\s*/i, "");
      if (same.trim() && !/^кафедра/i.test(same)) {
        teacher = extractTeacher(same) || null;
        break;
      }
      const idx = lines.indexOf(line);
      if (idx >= 0) {
        for (let j = idx + 1; j < Math.min(idx + 4, lines.length); j++) {
          if (lines[j].trim() && /[а-яА-Я]/.test(lines[j])) {
            teacher = extractTeacher(lines[j]) || null;
            break;
          }
        }
      }
      break;
    }
  }

  return {
    disciplins_name,
    faculty,
    department,
    direction,
    profile,
    education_level,
    education_form,
    year,
    teacher,
    raw: raw.length > 8000 ? `${raw.slice(0, 8000)}…` : raw,
  };
}
