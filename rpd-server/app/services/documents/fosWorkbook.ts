import ExcelJS from "exceljs";
import { fundsCompetences, selectedFundsQuestions } from "../../modules/assessmentFunds.ts";

export type FosTemplate = { disciplins_name: string | null; semester: number | null; assessment_tools_questions: unknown };
export type FosRow = { competence: string; semester: number | null; type: "открытый" | "закрытый"; number: number; question: string; answer: string; discipline: string };

const compareText = new Intl.Collator("ru-RU").compare;

function competenceKey(text: string): { prefix: string; number: number; code: string } {
  const match = /^([А-ЯЁA-Z]+)[-\s]*(\d+)/u.exec(text.trim());
  return match ? { prefix: match[1], number: Number(match[2]), code: `${match[1]} ${Number(match[2])}` } : { prefix: text, number: 0, code: text };
}

export function fosRows(templates: FosTemplate[]): FosRow[] {
  const questions: Array<{ sourceCompetence: string; row: FosRow; order: number }> = [];
  for (const template of templates) {
    for (const competence of fundsCompetences(template.assessment_tools_questions)) {
      const selected = selectedFundsQuestions(template.assessment_tools_questions, competence);
      for (const [type, items] of [["открытый", selected.open], ["закрытый", selected.closed]] as const) {
        for (const item of items) questions.push({
          sourceCompetence: competence,
          row: { competence: competenceKey(competence).code, semester: template.semester, type, number: 0, question: item.text, answer: item.answer, discipline: template.disciplins_name ?? "" },
          order: questions.length,
        });
      }
    }
  }
  questions.sort((left, right) => {
    const a = competenceKey(left.sourceCompetence);
    const b = competenceKey(right.sourceCompetence);
    return compareText(a.prefix, b.prefix) || a.number - b.number || compareText(left.sourceCompetence, right.sourceCompetence)
      || (left.row.type === right.row.type ? 0 : left.row.type === "открытый" ? -1 : 1)
      || (left.row.semester ?? Number.MAX_SAFE_INTEGER) - (right.row.semester ?? Number.MAX_SAFE_INTEGER)
      || compareText(left.row.discipline, right.row.discipline) || left.order - right.order;
  });
  const numbers = new Map<string, number>();
  return questions.map(({ sourceCompetence, row }) => {
    const key = JSON.stringify([sourceCompetence, row.type]);
    const number = (numbers.get(key) ?? 0) + 1;
    numbers.set(key, number);
    return { ...row, number };
  });
}

export async function buildFosWorkbook({ direction, profile, rows }: { direction: string | null; profile: string | null; year: number | null; rows: FosRow[] }): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("вопросы");
  sheet.columns = [
    { width: 12 }, { width: 14.4 }, { width: 10.6 }, { width: 7.1 },
    { width: 43.1 }, { width: 37.4 }, { width: 29.3 },
  ];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = `Вопросы фонда оценочных средств по указанной дисциплине полностью соответствуют содержанию рабочей программы дисциплины для направления ${direction ?? ""} (профиль: ${profile ?? ""}): формулировки вопросов корректны, однозначны и соответствуют уровню подготовки обучающихся. Оценочные материалы позволяют объективно оценить уровень формирования заявленных компетенций и могут быть использованы для проведения диагностической работы в рамках аккредитационного мониторинга.\n\n\n __________________ / ( ____________________________________________ )\n\n__________________${new Date().getFullYear()} г.\n\n\n`;
  sheet.getRow(1).height = 225;
  sheet.getCell("A1").alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(2).values = ["компетенция", "семестр", "тип вопроса", "номер", "вопрос", "правильный ответ", "дисциплина"];
  sheet.getRow(2).eachCell((cell) => { cell.alignment = { wrapText: true, vertical: "top" }; });
  rows.forEach((row) => {
    const sheetRow = sheet.addRow([row.competence, row.semester, row.type, row.number, row.question, row.answer, row.discipline]);
    sheetRow.eachCell({ includeEmpty: true }, (cell) => { cell.alignment = { wrapText: true, vertical: "top" }; });
  });
  sheet.eachRow((row) => row.eachCell({ includeEmpty: true }, (cell) => { cell.font = { name: "Helvetica Neue", size: 11 }; }));
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 2, topLeftCell: "A3" }];
  sheet.autoFilter = { from: "A2", to: `G${Math.max(2, rows.length + 2)}` };
  // ponytail: книга собирается в памяти; если комплект вырастет на порядок, перейти на ExcelJS.stream.xlsx.WorkbookWriter.
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
