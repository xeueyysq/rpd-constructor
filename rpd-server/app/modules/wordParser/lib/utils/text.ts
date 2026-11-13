import { normalizeLine, normalizeText } from "../docx/normalize-text.ts";

export { normalizeLine, normalizeText };

export function blockPlainText(
  block: { type: "paragraph"; text: string } | { type: "table"; rows: string[][] },
): string {
  if (block.type === "paragraph") {
    return block.text;
  }
  return block.rows
    .map((row) => row.map((c) => normalizeLine(c)).join(" | "))
    .join("\n");
}

export function blocksToText(blocks: { type: string; text?: string; rows?: string[][] }[]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph" && b.text) {
        return b.text;
      }
      if (b.type === "table" && b.rows) {
        return b.rows.map((r) => r.join("\t")).join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Извлечь первое вхождение года 20xx из титульного текста (в т.ч. «г. Город, 2024 г.»). */
export function parseYearFromText(text: string): number | null {
  const a = text.match(/(20\d{2})\s*г\.?/i);
  if (a) {
    return Number.parseInt(a[1], 10);
  }
  const b = text.match(/[,\s](20\d{2})\s*г\.?/i);
  if (b) {
    return Number.parseInt(b[1], 10);
  }
  const c = text.match(/(20\d{2})/);
  if (c) {
    return Number.parseInt(c[1], 10);
  }
  return null;
}
