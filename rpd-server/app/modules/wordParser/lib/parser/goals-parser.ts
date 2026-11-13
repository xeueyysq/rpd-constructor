import { blocksToText } from "../utils/text.ts";
import { normalizeText } from "../docx/normalize-text.ts";
import type { DocumentBlock } from "../../types/parser.ts";

const END = /Место дисциплины в структуре/i;

export function parseGoalsSection(blocks: DocumentBlock[] | undefined): {
  text: string | null;
} {
  if (!blocks?.length) {
    return { text: null };
  }
  const full = blocksToText(blocks);
  const endIdx = full.search(END);
  const slice = endIdx >= 0 ? full.slice(0, endIdx) : full;
  const t = normalizeText(slice);
  return { text: t || null };
}
