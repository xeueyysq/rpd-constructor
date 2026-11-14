import { SECTION_PATTERNS } from "../utils/constants.ts";
import type { DocumentBlock, DocumentSections, SectionKey } from "../../types/parser.ts";
import { blocksToText } from "../utils/text.ts";

function blockTextForHeaderMatch(b: DocumentBlock): string {
  if (b.type === "paragraph") {
    return b.text;
  }
  if (b.type === "table" && b.rows.length) {
    return b.rows[0].join(" ");
  }
  return "";
}

export function splitDocumentIntoSections(blocks: DocumentBlock[]): DocumentSections {
  const result: DocumentSections = {
    preSection: [],
  };
  let current: "pre" | SectionKey = "pre";

  const orderedKeys: SectionKey[] = [
    "goals",
    "place",
    "competencies",
    "volume",
    "content",
    "methodologicalSupport",
    "assessmentTools",
    "resources",
    "literature",
    "software",
    "materialSupport",
  ];
  const patternList = orderedKeys
    .map((k) => [k, SECTION_PATTERNS[k as keyof typeof SECTION_PATTERNS]] as const)
    .filter((x) => x[1]);

  for (const b of blocks) {
    const header = blockTextForHeaderMatch(b);
    for (const [key, re] of patternList) {
      if (re.test(header)) {
        current = key;
        break;
      }
    }
    if (current === "pre") {
      result.preSection.push(b);
    } else {
      if (!result[current]) {
        result[current] = [];
      }
      result[current]!.push(b);
    }
  }
  return result;
}

export function sectionsToPlain(sections: DocumentSections): string {
  return Object.entries(sections)
    .map(([k, v]) => `${k}:\n${v ? blocksToText(v) : ""}`)
    .join("\n\n");
}
