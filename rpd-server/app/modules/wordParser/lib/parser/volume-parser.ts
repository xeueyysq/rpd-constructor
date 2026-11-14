import { blocksToText } from "../utils/text.ts";
import type { DocumentBlock } from "../../types/parser.ts";

const ZET_PATTERNS = [
  /составляет\s+(\d+(?:[,.]\d+)?)\s+зач/i,
  /(\d+(?:[,.]\d+)?)\s*зач\.?\s*ед/i,
  /(\d+(?:[,.]\d+)?)\s+зач[её]тн(?:ых|ая|ые)?\s+единиц/i,
  /трудо[ёе]мкост[ьи][^.]{0,160}?(\d+(?:[,.]\d+)?)\s+зач/i,
  /трудо[её]мкость\s+дисциплины[^.\n]{0,80}?(\d+(?:[,.]\d+)?)/i,
  /зач[её]тн(?:ых|ая|ые)?\s+единиц[аы]?[^\d]{0,6}(\d+(?:[,.]\d+)?)/i,
  /общая\s+трудо[её]мкость[^.\n]{0,120}?(\d+(?:[,.]\d+)?)/i,
  /объ[её]м[^.\n]{0,120}?(\d+(?:[,.]\d+)?)\s*зач/i,
];

export function parseVolumeSection(blocks: DocumentBlock[] | undefined): {
  zet: number | null;
} {
  if (!blocks?.length) {
    return { zet: null };
  }
  const t = blocksToText(blocks);
  for (const p of ZET_PATTERNS) {
    const m = t.match(p);
    if (m?.[1]) {
      const n = Number.parseFloat(m[1].replace(",", "."));
      if (!Number.isNaN(n)) {
        return { zet: Math.round(n) };
      }
    }
  }
  return { zet: null };
}
