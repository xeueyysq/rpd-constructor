import type { ComplectCompetency } from "@entities/rpd-complect";
import type { ParsedPlannedResults } from "@shared/ability/lib/parseCsvToJson";

const normalize = (code: string) =>
  code
    .replace(/[–—‑]/g, "-")
    .replace(/^([A-Za-zА-Яа-яЁё]{1,16})\s+(\d)/, "$1-$2")
    .replace(/\s+/g, "")
    .toUpperCase();
const competenceCode = /^[A-ZА-ЯЁ]{1,16}-\d+[A-ZА-ЯЁ]*$/;
const indicatorCode = /^[A-ZА-ЯЁ]{1,16}-\d+[A-ZА-ЯЁ]*(\.\d+[A-ZА-ЯЁ]*)+$/;

export function groupCompetencies(
  parsed: ParsedPlannedResults
): ComplectCompetency[] {
  const entries: ComplectCompetency[] = [];
  let competence = "";
  let code = "";
  let current: ComplectCompetency | undefined;
  let hasChild = false;
  for (const [index, item] of Object.entries(parsed)) {
    const fail = () => {
      throw new Error(
        `Некорректная строка ${Number(index) + 2} файла компетенций`
      );
    };
    const result = item.results.trim();
    const comp = normalize(item.competence);
    const indicator = normalize(item.indicator);
    if (!result) fail();
    if (comp) {
      if (!competenceCode.test(comp) || indicator || (competence && !hasChild))
        fail();
      competence = `${comp}. ${result}`;
      code = comp;
      current = undefined;
      hasChild = false;
    } else if (indicator) {
      if (
        !competence ||
        !indicatorCode.test(indicator) ||
        !indicator.startsWith(`${code}.`)
      )
        fail();
      current = {
        competence,
        indicator: `${indicator}. ${result}`,
        disciplines: [],
      };
      entries.push(current);
      hasChild = true;
    } else {
      if (!competence) fail();
      if (!current) {
        current = { competence, indicator: "—", disciplines: [] };
        entries.push(current);
      }
      if (!current.disciplines.includes(result))
        current.disciplines.push(result);
      hasChild = true;
    }
  }
  if (!entries.length || !hasChild)
    throw new Error("Файл не содержит полной матрицы компетенций");
  return entries;
}
