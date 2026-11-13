import { DOMParser } from "@xmldom/xmldom";
import type { DocumentBlock } from "../../types/parser.ts";
import { normalizeLine } from "./normalize-text.ts";
import { getDocumentXmlFromDocx } from "./extract-ooxml.ts";

function isTag(node: { nodeName: string } | null, name: string): boolean {
  if (!node) {
    return false;
  }
  return node.nodeName === `w:${name}` || node.nodeName === name || node.nodeName.endsWith(`:${name}`);
}

function cellText(node: { textContent?: string | null }): string {
  return normalizeLine((node.textContent || "").replace(/\s+/g, " "));
}

function directChildren(el: Element, tag: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes.item(i);
    if (c && c.nodeType === 1 && (c as Element).nodeName === tag) {
      out.push(c as Element);
    }
  }
  return out;
}

function tableRowsFromTbl(tbl: Element): string[][] {
  const out: string[][] = [];
  for (const tr of directChildren(tbl, "w:tr")) {
    const row: string[] = [];
    for (const tc of directChildren(tr, "w:tc")) {
      row.push(cellText(tc));
    }
    if (row.length) {
      out.push(row);
    }
  }
  return out;
}

type El = { nodeType: number; nodeName: string; childNodes: { length: number; item: (i: number) => El | null } };

function forEachBlockElement(
  body: El,
  onP: (p: Element) => void,
  onTbl: (t: Element) => void,
): void {
  const walk = (parent: El) => {
    for (let i = 0; i < parent.childNodes.length; i++) {
      const n = parent.childNodes.item(i) as unknown as (El & { textContent?: string }) | null;
      if (!n || n.nodeType !== 1) {
        continue;
      }
      if (n.nodeName === "w:sectPr") {
        continue;
      }
      if (isTag(n, "p")) {
        onP(n as unknown as Element);
      } else if (isTag(n, "tbl")) {
        onTbl(n as unknown as Element);
      } else if (n.nodeName === "w:sdt" || n.nodeName === "sdt") {
        const sdt = n as El & { getElementsByTagName?: (q: string) => unknown };
        const sdtC = sdt.getElementsByTagName?.("w:sdtContent") as { item?: (i: number) => El } | undefined;
        const content =
          sdtC && (sdtC as { length: number; item: (i: number) => El }).length
            ? (sdtC as { item: (i: number) => El }).item(0)
            : null;
        if (content) {
          walk(content as El);
        }
      }
    }
  };
  walk(body);
}

/**
 * Парсит .docx: порядок абзацев и таблиц по word/document.xml.
 */
export async function readDocxToBlocks(
  data: ArrayBuffer,
): Promise<{ blocks: DocumentBlock[]; error?: string }> {
  const { xml, error: xmlError } = await getDocumentXmlFromDocx(data);
  if (xmlError || !xml) {
    return { blocks: [], error: "Не найден document.xml" };
  }

  let doc: ReturnType<DOMParser["parseFromString"]>;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xml, "application/xml");
  } catch {
    return { blocks: [], error: "parse" };
  }

  const body =
    doc.getElementsByTagName("w:body")[0] || doc.getElementsByTagName("body")[0] || doc.documentElement;

  if (!body) {
    return { blocks: [], error: "body" };
  }

  const blocks: DocumentBlock[] = [];
  let index = 0;
  forEachBlockElement(
    body as El,
    (p) => {
      const text = cellText(p);
      blocks.push({ type: "paragraph", text, index: index++ });
    },
    (tbl) => {
      const rows = tableRowsFromTbl(tbl);
      if (rows.length) {
        blocks.push({ type: "table", rows, index: index++ });
      }
    },
  );

  return { blocks };
}
