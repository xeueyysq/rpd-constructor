import type { DocumentBlock } from "../../types/parser.ts";
import type { CompetencyItem } from "../../types/discipline.ts";
import { blocksToText } from "../utils/text.ts";
import { normalizeLine, normalizeText } from "../docx/normalize-text.ts";

const ANY_HEADER =
  /формируем|индикатор|планируем|достижен|знат|знать|уметь|владет|владени|компетенц/i;
const SUB_CODE = /((?:УК|ОПК|ПК|ПКО|ПКС)-\d+\.\d+)/iu;

export function fixIndicatorSpacing(text: string): string {
  return text.replace(/((?:УК|ОПК|ПК|ПКО|ПКС)-\d+\.\d+)(?=[А-ЯЁA-ZА-я])/g, "$1 ");
}

export function parseCompetencyCodeAndName(text: string): { code: string; name: string | null } | null {
  if (parseIndicator(text)) {
    return null;
  }
  const normalized = normalizeLine(fixIndicatorSpacing(text));
  const m = normalized.match(/^\s*((?:УК|ОПК|ПК|ПКО|ПКС)-\d+)(?![.\d])/iu);
  if (!m) {
    return null;
  }
  const code = m[1]!;
  const afterCode = normalized
    .replace(new RegExp(`^\\s*${escapeRe(code)}\\s*:?\\s*`, "i"), "")
    .replace(/[;.]?\s*$/g, "")
    .trim();
  return { code, name: afterCode || null };
}

export function parseIndicator(text: string): { code: string; text: string } | null {
  const normalized = fixIndicatorSpacing(normalizeLine(text));
  const m = normalized.match(/((?:УК|ОПК|ПК|ПКО|ПКС)-\d+\.\d+)/iu);
  if (!m) {
    return null;
  }
  const code = m[1]!;
  const rest = normalized
    .replace(new RegExp(`^\\s*${escapeRe(code)}\\s*`, "i"), "")
    .trim();
  return { code, text: rest };
}

function escapeRe(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/** ОПК-5.2 → ОПК-5 (родительская компетенция для группировки строк таблицы). */
function mainCompetencyCodeFromIndicatorCode(code: string): string | null {
  const m = code.match(/^((?:УК|ОПК|ПК|ПКО|ПКС)-\d+)/iu);
  return m ? m[1]! : null;
}

function extractAfterLabel(text: string, starts: string[], stops: string[]): string | null {
  let bestI = -1;
  let bestLen = 0;
  for (const s of starts) {
    const idx = text.toLowerCase().indexOf(s.toLowerCase());
    if (idx >= 0 && (bestI < 0 || idx < bestI)) {
      bestI = idx;
      bestLen = s.length;
    }
  }
  if (bestI < 0) {
    return null;
  }
  let rest = text.slice(bestI + bestLen).trim();
  const low = rest.toLowerCase();
  let end = rest.length;
  for (const st of stops) {
    if (!st) {
      continue;
    }
    const j = low.indexOf(st.toLowerCase());
    if (j > 0) {
      end = Math.min(end, j);
    }
  }
  rest = rest.slice(0, end).replace(/;?\s*$/g, "").trim();
  return rest || null;
}

function cleanupResultText(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^[;.,\s]+|[;.,\s]+$/g, "").trim();
}

export function parseLearningResults(text: string): {
  know: string[];
  can: string[];
  own: string[];
} {
  const normalized = normalizeText(text).replace(/\s+/g, " ").trim();
  const know = extractAfterLabel(normalized, ["Знать", "знать"], [
    "Уметь",
    "Владеть",
    "Владеет",
    "Владение",
    "уметь",
    "владеть",
    "владение",
  ]);
  const can = extractAfterLabel(normalized, ["Уметь", "уметь"], [
    "Владеть",
    "Владеет",
    "Владение",
    "владеть",
    "владение",
  ]);
  const own = extractAfterLabel(
    normalized,
    ["Владеть", "Владеет", "владеть", "Владение", "владение"],
    [],
  );
  return {
    know: know ? [cleanupResultText(know)] : [],
    can: can ? [cleanupResultText(can)] : [],
    own: own ? [cleanupResultText(own)] : [],
  };
}

/** Несколько кодов индикаторов в одной строке/ячейке (план 09/11). */
export function extractIndicatorsFromRowText(
  rowText: string,
  parentCode?: string | null,
): { code: string; text: string }[] {
  const normalized = fixIndicatorSpacing(normalizeText(rowText)).replace(/\s+/g, " ").trim();
  const re = new RegExp(SUB_CODE.source, "giu");
  const matches = [...normalized.matchAll(re)];
  if (!matches.length) {
    return [];
  }
  const pc = parentCode?.trim();
  const parentPrefix =
    pc && /^(?:УК|ОПК|ПК|ПКО|ПКС)-\d+$/iu.test(pc) ? `${pc}.` : null;

  const out: { code: string; text: string }[] = [];
  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]!;
    const code = match[1] ?? match[0]!;
    if (parentPrefix && !code.toUpperCase().startsWith(parentPrefix.toUpperCase())) {
      continue;
    }
    const start = (match.index ?? 0) + match[0]!.length;
    const next = matches[index + 1];
    const end = next?.index ?? normalized.length;
    const text = normalized.slice(start, end).trim();
    if (text.length > 5 || matches.length === 1) {
      out.push({ code, text });
    }
  }
  return out;
}

export type ParseCompetenciesOptions = {
  /**
   * Повторный проход только по «похожим на компетенции» таблицам.
   * Должен быть выключен во вложенном вызове — иначе возможна бесконечная рекурсия.
   */
  allowHeuristicRetry?: boolean;
};

/** Таблица похожа на компетенции: коды + Знать/Уметь/индикатор (план 11). */
function tableBlocksLookLikeCompetency(rows: string[][]): boolean {
  const blob = padRows(rows)
    .map((r) => r.join(" "))
    .join(" ")
    .toLowerCase();
  return (
    /(ук|опк|пк|пко|пкс)-\d/i.test(blob) &&
    /(знать|уметь|владет|владени|индикатор)/.test(blob)
  );
}

function pushComp(
  map: Record<string, CompetencyItem>,
  code: string,
  patch: Partial<CompetencyItem>,
) {
  const c = code.trim();
  if (!c) {
    return;
  }
  if (!map[c]) {
    map[c] = { code: c, name: "", indicators: [], results: {} };
  }
  const { results: resPatch, ...restPatch } = patch;
  Object.assign(map[c]!, restPatch);
  if (patch.name) {
    map[c]!.name = patch.name;
  }
  if (patch.indicators?.length) {
    const prevI = map[c]!.indicators || [];
    const merged = [...prevI];
    for (const x of patch.indicators) {
      if (x.code === null) {
        const existing = merged.find((m) => m.code === null);
        if (existing) {
          existing.text = [existing.text, x.text].filter(Boolean).join(" ").trim();
        } else if (x.text?.trim()) {
          merged.push(x);
        }
        continue;
      }
      if (!merged.some((m) => m.code === x.code)) {
        merged.push(x);
      }
    }
    map[c]!.indicators = merged;
  }
  if (resPatch) {
    const prev = map[c]!.results || {};
    const next = { ...prev };
    for (const k of ["know", "can", "own", "raw"] as const) {
      const v = resPatch[k];
      if (v === undefined) {
        continue;
      }
      if (k === "raw" && Array.isArray(v) && v.length === 0) {
        next.raw = [];
        continue;
      }
      if (v?.length) {
        next[k] = [...(prev[k] || []), ...v];
      }
    }
    map[c]!.results = next;
  }
}

type Row = string[];
function padRows(rows: Row[]): Row[] {
  const m = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array.from({ length: m - r.length }, () => "")]);
}

/** Убирает из названия компетенции встроенный код индикатора (ОПК-5.2…). */
function detachIndicatorFromName(
  name: string,
  indicators: { code: string | null; text: string }[],
): string {
  let n = fixIndicatorSpacing(normalizeLine(name));
  const ind = parseIndicator(n);
  if (!ind) {
    return n;
  }
  if (n.startsWith(ind.code) || new RegExp(`^\\s*${escapeRe(ind.code)}`, "i").test(n)) {
    if (!indicators.some((x) => x.code === ind.code)) {
      indicators.push({ code: ind.code, text: ind.text });
    }
    n = n
      .replace(new RegExp(`^\\s*${escapeRe(ind.code)}(?:\\S*)?\\s*`, "i"), "")
      .trim();
  }
  return n || name;
}

function flushGroup(
  map: Record<string, CompetencyItem>,
  mainCode: string,
  groupRows: Row[],
  knowIdx: number,
  canIdx: number,
  ownIdx: number,
  indicatorColIdx: number,
) {
  if (!groupRows.length) {
    return;
  }
  const indicators: { code: string | null; text: string }[] = [];
  let parsed: { code: string; name: string | null } | null = null;
  let name = "";
  for (const r of groupRows) {
    const headText = [r[0], r[1], r[2]].filter(Boolean).join(" ");
    const p =
      parseCompetencyCodeAndName(headText) ||
      parseCompetencyCodeAndName([r[0], r[1]].filter(Boolean).join(" ")) ||
      parseCompetencyCodeAndName(r[0] || "");
    if (p?.name) {
      parsed = p;
      name = p.name;
      break;
    }
  }
  if (!name) {
    const head = groupRows[0]!;
    const headText = [head[0], head[1], head[2]].filter(Boolean).join(" ");
    parsed =
      parseCompetencyCodeAndName(headText) ||
      parseCompetencyCodeAndName([head[0], head[1]].filter(Boolean).join(" ")) ||
      parseCompetencyCodeAndName(head[0]!);
    name = parsed?.name || "";
    if (!name && head[1]?.trim() && !parseIndicator(head[1]!)) {
      name = normalizeLine(head[1]!);
    }
  }
  for (const r of groupRows) {
    const cells = r.slice(0, 8);
    let ind: ReturnType<typeof parseIndicator> = null;
    let indCellIdx = -1;
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      if (!cell?.trim()) {
        continue;
      }
      const c = fixIndicatorSpacing(normalizeLine(cell));
      const tryInd = parseIndicator(c);
      if (tryInd) {
        ind = tryInd;
        indCellIdx = ci;
        break;
      }
    }
    if (!ind && r[0] && r[1]) {
      ind = parseIndicator(`${r[0]} ${r[1]}`);
      indCellIdx = 0;
    }
    if (ind) {
      const { code } = ind;
      let { text } = ind;
      if ((!text || text.length < 3) && indCellIdx >= 0) {
        for (let ni = indCellIdx + 1; ni < cells.length; ni++) {
          const rawNext = cells[ni];
          if (!rawNext?.trim()) {
            continue;
          }
          const next = normalizeLine(rawNext);
          if (parseIndicator(next)) {
            break;
          }
          if (parseCompetencyCodeAndName(next)) {
            break;
          }
          text = [text, next].filter(Boolean).join(" ").trim();
          break;
        }
      }
      if (!indicators.some((x) => x.code === code)) {
        indicators.push({ code, text });
      }
    }
  }
  if (!indicators.length) {
    for (const r of groupRows) {
      const packed = normalizeLine(r.filter((c) => c?.trim()).join(" "));
      if (packed.length < 8) {
        continue;
      }
      const ind = parseIndicator(fixIndicatorSpacing(packed));
      if (!ind) {
        continue;
      }
      const parent = mainCompetencyCodeFromIndicatorCode(ind.code);
      if (parent === mainCode && !indicators.some((x) => x.code === ind.code)) {
        indicators.push(ind);
      }
    }
  }
  if (!indicators.length) {
    for (const r of groupRows) {
      for (const piece of extractIndicatorsFromRowText(r.join(" "), mainCode)) {
        if (!indicators.some((x) => x.code === piece.code)) {
          indicators.push(piece);
        }
      }
    }
  }
  if (!indicators.length && indicatorColIdx >= 0) {
    const parts: string[] = [];
    for (const r of groupRows) {
      const cell = r[indicatorColIdx]?.trim();
      if (!cell || cell.length < 8) {
        continue;
      }
      if (parseIndicator(cell)) {
        continue;
      }
      parts.push(normalizeLine(cell));
    }
    const blob = parts.join(" ").trim();
    if (blob.length > 15) {
      indicators.push({ code: null, text: blob });
    }
  }
  name = detachIndicatorFromName(name, indicators);
  if ((!name || name === "—") && groupRows[0]) {
    const head = groupRows[0]!;
    if (head[1]?.trim()) {
      const cand = normalizeLine(head[1]!);
      if (!parseIndicator(cand)) {
        name = cand;
      }
    }
  }
  const merged = groupRows.map((r) => r.join(" | ")).join("\n");
  const fromText = parseLearningResults(merged.replace(/\s*\|\s*/g, " "));
  const know: string[] = [...fromText.know];
  const can: string[] = [...fromText.can];
  const own: string[] = [...fromText.own];
  for (const r of groupRows) {
    if (knowIdx >= 0 && r[knowIdx]?.trim().length > 2 && /[а-яё]/i.test(r[knowIdx]!)) {
      const k = normalizeLine(r[knowIdx]!);
      if (!know.some((x) => x.includes(k.slice(0, 12)))) {
        know.push(k);
      }
    }
    if (canIdx >= 0 && r[canIdx]?.trim().length > 2 && /[а-яё]/i.test(r[canIdx]!)) {
      const k = normalizeLine(r[canIdx]!);
      if (!can.some((x) => x.includes(k.slice(0, 12)))) {
        can.push(k);
      }
    }
    if (ownIdx >= 0 && r[ownIdx]?.trim().length > 2 && /[а-яё]/i.test(r[ownIdx]!)) {
      const k = normalizeLine(r[ownIdx]!);
      if (!own.some((x) => x.includes(k.slice(0, 12)))) {
        own.push(k);
      }
    }
  }
  pushComp(map, mainCode, {
    code: mainCode,
    name: name || parsed?.name || "—",
    indicators,
    results: { know, can, own, raw: [] },
  });
}

export function parseCompetenciesSection(
  blocks: DocumentBlock[] | undefined,
  options?: ParseCompetenciesOptions,
): {
  competencies: Record<string, CompetencyItem>;
  rawText: string;
} {
  if (!blocks?.length) {
    return { competencies: {}, rawText: "" };
  }
  const allowHeuristicRetry = options?.allowHeuristicRetry !== false;
  const map: Record<string, CompetencyItem> = {};
  const rawText = blocksToText(blocks);

  for (const b of blocks) {
    if (b.type !== "table") {
      continue;
    }
    const rows = padRows(b.rows);
    if (!rows.length) {
      continue;
    }

    let startRow = 0;
    let knowIdx = -1;
    let canIdx = -1;
    let ownIdx = -1;
    let indicatorColIdx = -1;
    for (let ri = 0; ri < Math.min(3, rows.length); ri++) {
      const row = rows[ri]!;
      const joined = row.join(" ").toLowerCase();
      const hasSub = row.some((c) => SUB_CODE.test(c));
      if (!hasSub && ANY_HEADER.test(joined)) {
        startRow = ri + 1;
        indicatorColIdx = -1;
        const h = row.map((c) => c.toLowerCase());
        for (let i = 0; i < h.length; i++) {
          if (/знат|^зн\.?$|знать/.test(h[i]!)) {
            knowIdx = i;
          }
          if (/уметь/.test(h[i]!)) {
            canIdx = i;
          }
          if (/владет|владеет|владени/.test(h[i]!)) {
            ownIdx = i;
          }
          if (
            /индикатор/i.test(h[i]!) &&
            /(достижен|компетенц|формир|планир)/i.test(h[i]!)
          ) {
            indicatorColIdx = i;
          } else if (/^индикаторы?\s*$/i.test(h[i]!.trim())) {
            indicatorColIdx = i;
          } else if (/планируемые\s+результаты\s+освоения/i.test(h[i]!)) {
            indicatorColIdx = i;
          } else if (/планируемые\s+результаты\s+обучения/i.test(h[i]!)) {
            indicatorColIdx = i;
          } else if (/^результаты\s+обучения$/i.test(h[i]!.trim())) {
            indicatorColIdx = i;
          } else if (/индикатор\s+достижен/i.test(h[i]!)) {
            indicatorColIdx = i;
          }
        }
        break;
      }
    }
    if (knowIdx < 0) {
      const header = rows[0]!.map((c) => c.toLowerCase());
      for (let i = 0; i < header.length; i++) {
        if (/знат|знать/.test(header[i]!)) {
          knowIdx = i;
        }
      }
    }

    let currentMain: string | null = null;
    let group: Row[] = [];

    for (let rj = startRow; rj < rows.length; rj++) {
      const row = rows[rj]!;
      const c0 = row[0] || "";
      const lineJoin = row.join(" ");
      if (!lineJoin.trim()) {
        continue;
      }

      const rowInd =
        parseIndicator(c0) || (row[1] ? parseIndicator(`${c0} ${row[1]}`) : null);
      if (rowInd) {
        const parent = mainCompetencyCodeFromIndicatorCode(rowInd.code);
        if (currentMain) {
          if (parent && parent !== currentMain) {
            flushGroup(map, currentMain, group, knowIdx, canIdx, ownIdx, indicatorColIdx);
            currentMain = parent;
            group = [row];
          } else {
            group.push(row);
          }
        } else if (parent) {
          currentMain = parent;
          group = [row];
        }
        continue;
      }
      const headText = [c0, row[1], row[2]].filter(Boolean).join(" ");
      const mainStart =
        parseCompetencyCodeAndName(headText) ||
        parseCompetencyCodeAndName(c0) ||
        parseCompetencyCodeAndName([c0, row[1]].filter(Boolean).join(" "));
      if (mainStart && (mainStart.name || headText.length > 12)) {
        if (currentMain && currentMain !== mainStart.code) {
          flushGroup(map, currentMain, group, knowIdx, canIdx, ownIdx, indicatorColIdx);
        }
        currentMain = mainStart.code;
        if (group.length && currentMain === mainStart.code) {
          group.push(row);
        } else {
          group = [row];
        }
        continue;
      }
      if (currentMain) {
        group.push(row);
      }
    }
    if (currentMain && group.length) {
      flushGroup(map, currentMain, group, knowIdx, canIdx, ownIdx, indicatorColIdx);
    }
  }

  if (Object.keys(map).length === 0 && allowHeuristicRetry) {
    const compTables = blocks.filter(
      (b): b is DocumentBlock & { type: "table" } =>
        b.type === "table" && tableBlocksLookLikeCompetency(b.rows),
    );
    if (compTables.length) {
      const narrowed = parseCompetenciesSection(compTables, { allowHeuristicRetry: false });
      if (Object.keys(narrowed.competencies).length > 0) {
        return narrowed;
      }
    }
    return parseCompetenciesLegacy(blocks, rawText);
  }
  if (Object.keys(map).length === 0) {
    return parseCompetenciesLegacy(blocks, rawText);
  }
  return { competencies: map, rawText };
}

const CODE = /(УК|ОПК|ПК|ОПК-У|УК-ОП|ОП|П|УК-ВК)-?\s*\d+(?:[.,]\d+)?/i;

/** Резерв: построчный разбор как раньше, если блочная логика ничего не дала. */
function parseCompetenciesLegacy(
  blocks: DocumentBlock[],
  rawText: string,
): { competencies: Record<string, CompetencyItem>; rawText: string } {
  const map: Record<string, CompetencyItem> = {};
  for (const b of blocks) {
    if (b.type !== "table") {
      continue;
    }
    const rows = padRows(b.rows);
    if (!rows.length) {
      continue;
    }
    let startRow = 0;
    let knowIdx = -1;
    let canIdx = -1;
    let ownIdx = -1;
    for (let ri = 0; ri < Math.min(2, rows.length); ri++) {
      const row = rows[ri]!;
      const joined = row.join(" ").toLowerCase();
      const hasCode = row.some((c) => CODE.test(c));
      if (!hasCode && ANY_HEADER.test(joined)) {
        startRow = ri + 1;
        const h = row.map((c) => c.toLowerCase());
        for (let i = 0; i < h.length; i++) {
          if (/знат|^зн\.?$|знать/.test(h[i]!)) {
            knowIdx = i;
          }
          if (/уметь/.test(h[i]!)) {
            canIdx = i;
          }
          if (/владет|владеет|владени/.test(h[i]!)) {
            ownIdx = i;
          }
        }
        break;
      }
    }
    if (knowIdx < 0) {
      const header = rows[0]!.map((c) => c.toLowerCase());
      for (let i = 0; i < header.length; i++) {
        if (/знат|знать/.test(header[i]!)) {
          knowIdx = i;
        }
      }
    }
    for (let rj = startRow; rj < rows.length; rj++) {
      const row = rows[rj]!;
      if (row.length < 1) {
        continue;
      }
      const line = row.map((c) => normalizeLine(c));
      const joined = line.join(" | ");
      const m = line[0]!.match(CODE) || line.join(" ").match(CODE);
      if (!m) {
        if (row.some((c) => c.length > 20)) {
          for (const c of line) {
            const m2 = c.match(CODE);
            if (m2) {
              pushComp(map, m2[0]!, {
                name: line.find((t) => t.length > 30) || c,
                results: { raw: [joined] },
              });
            }
          }
        }
        continue;
      }
      const mainCode = m[0]!.replace(/\s+/g, "-").replace(/--/g, "-");
      let mapKey = mainCode;
      const indMatch = line.some((c) => {
        const x = c.match(new RegExp(CODE.source, "i"));
        return Boolean(x && c.length < 50);
      });
      if (indMatch) {
        const indCode = line.find((c) => {
          const x = c.match(new RegExp(CODE.source, "i"));
          return x && c.length < 50;
        });
        if (indCode) {
          const ic = (indCode.match(CODE) || [])[0] || indCode;
          const mainFromFirst = (line[0]!.match(CODE) || [])[0] || mainCode;
          mapKey = mainFromFirst.replace(/\s+/g, "-");
          const pInd = parseIndicator(line[0]!) || (line[1] ? parseIndicator(`${line[0]} ${line[1]}`) : null);
          pushComp(map, mapKey, {
            code: mapKey,
            name: pInd
              ? line
                  .filter((t) => t.length > 5)
                  .map((t) => normalizeLine(t))
                  .join(" ")
                  .replace(pInd.code, "")
                  .trim() || "—"
              : line.find((t) => t.length > 40) || line[1]! || "",
            indicators: pInd
              ? [{ code: pInd.code, text: pInd.text }]
              : [{ code: ic, text: line.filter((t) => t.length > 5).join(" ") }],
          });
        }
      } else {
        const name =
          line[1] && line[1]!.length > 3
            ? line[1]!
            : line[0]!.replace(m[0]!, "").trim() || "—";
        const pr = parseLearningResults(joined);
        pushComp(map, mainCode, {
          code: mainCode,
          name: normalizeLine(name),
          results: { know: pr.know, can: pr.can, own: pr.own, raw: [joined] },
        });
      }
      if (knowIdx >= 0 && row[knowIdx] && row[knowIdx]!.trim().length > 2) {
        const know = row[knowIdx]!;
        if (know && /[а-яА-Яa-z]/i.test(know)) {
          pushComp(map, mapKey, { results: { know: [normalizeLine(know)] } });
        }
      }
      if (canIdx >= 0) {
        const can = row[canIdx]?.trim() ?? "";
        if (can.length > 2) {
          pushComp(map, mapKey, { results: { can: [normalizeLine(can)] } });
        }
      }
      if (ownIdx >= 0) {
        const own = row[ownIdx]?.trim() ?? "";
        if (own.length > 2) {
          pushComp(map, mapKey, { results: { own: [normalizeLine(own)] } });
        }
      }
    }
  }
  return { competencies: map, rawText };
}
