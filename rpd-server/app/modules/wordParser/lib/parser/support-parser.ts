import { blocksToText } from "../utils/text.ts";
import { normalizeText } from "../docx/normalize-text.ts";
import type { DocumentBlock } from "../../types/parser.ts";

const END = /Фонд оценочных средств|Ресурсное обеспечение/i;

export function parseMethodologicalSection(blocks: DocumentBlock[] | undefined): string | null {
  if (!blocks?.length) {
    return null;
  }
  const t = blocksToText(blocks);
  const i = t.search(END);
  const slice = i > 0 ? t.slice(0, i) : t;
  const out = normalizeText(slice);
  return out || null;
}

const END2 = /Ресурсное обеспечение|Перечень литературы|Основная литерату/i;

export function parseAssessmentSection(blocks: DocumentBlock[] | undefined): string | null {
  if (!blocks?.length) {
    return null;
  }
  const t = blocksToText(blocks);
  const i = t.search(END2);
  const slice = i > 0 ? t.slice(0, i) : t;
  const out = normalizeText(slice);
  return out || null;
}
