import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import { getLatestFieldChanges } from "../modules/complectSync.ts";
import { deriveCertification, getStudyPlanHours } from "../modules/disciplineScope.ts";
import { isEditableTemplateField } from "../validators/RpdProfileTemplates.ts";
import RpdProfileTemplates from "../models/rpd_profile_templates.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import { NotFound, Unprocessable } from "../utils/Errors.ts";
import { buildFosWorkbook, fosRows } from "../services/documents/fosWorkbook.ts";
import {
  AlignmentType,
  BorderStyle,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TableLayoutType,
  WidthType,
} from "docx";

const TABLE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "000000",
};
const CONTENT_WIDTH = 9300;
const DIRECTIONS_COLUMNS = {
  direction: 4650,
  disciplines: 4650,
};
const QUESTIONS_COLUMNS = {
  number: 550,
  question: 4800,
  answer: 1600,
  discipline: 2350,
};

const SP = {
  afterTitle: 360,
  afterDirectionsIntro: 240,
  afterDirectionsTable: 520,
  afterTasksIntro: 400,
  afterOpenListTitle: 240,
  beforeClosedListTitle: 560,
  afterClosedListTitle: 240,
  defaultLine: 276,
};

type TextOptions = { size?: number; bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; line?: number; lineRule?: (typeof LineRuleType)[keyof typeof LineRuleType] };
type AssessmentQuestion = { text?: string; answer?: string; discipline?: string | null };
type AssessmentFundsData = { directions: { direction: string | null; profile: string | null; disciplines: string[] }[]; openQuestions: AssessmentQuestion[]; closedQuestions: AssessmentQuestion[]; competence: string };

function text(value: string, options: TextOptions = {}) {
  return new TextRun({
    text: value ?? "",
    font: "Times New Roman",
    size: options.size ?? 24,
    bold: options.bold,
  });
}

function paragraph(value: string, options: TextOptions = {}) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: {
      before: options.before ?? 0,
      after: options.after ?? 0,
      line: options.line ?? SP.defaultLine,
      lineRule: options.lineRule ?? LineRuleType.AUTO,
    },
    children: [text(value, options)],
  });
}

function spacerParagraph(before: number, after: number) {
  return new Paragraph({
    spacing: {
      before,
      after,
      line: 40,
      lineRule: LineRuleType.EXACT,
    },
    children: [
      new TextRun({
        text: "\u200b",
        font: "Times New Roman",
        size: 2,
      }),
    ],
  });
}

function cell(children: string | Paragraph[], width: number, options: TextOptions = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      right: TABLE_BORDER,
    },
    children: Array.isArray(children) ? children : [paragraph(children, options)],
  });
}

function buildAssessmentFundsDoc(data: AssessmentFundsData) {
  const directionRows = data.directions.length
    ? data.directions
    : [{ direction: "", profile: "", disciplines: [] }];
  const minRows = 25;
  const openRowsCount = Math.max(minRows, data.openQuestions.length);
  const closedRowsCount = Math.max(minRows, data.closedQuestions.length);

  const directionsTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [
      DIRECTIONS_COLUMNS.direction,
      DIRECTIONS_COLUMNS.disciplines,
    ],
    rows: [
      new TableRow({
        children: [
          cell("Направления бакалавриата ИСАУ", DIRECTIONS_COLUMNS.direction, {
            bold: true,
            alignment: AlignmentType.CENTER,
          }),
          cell("Дисциплины", DIRECTIONS_COLUMNS.disciplines, {
            bold: true,
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
      ...directionRows.map((row) => {
        const directionLabel = [row.direction, row.profile]
          .filter(Boolean)
          .join(" ");
        return new TableRow({
          children: [
            cell(directionLabel, DIRECTIONS_COLUMNS.direction),
            cell((row.disciplines ?? []).join(", "), DIRECTIONS_COLUMNS.disciplines),
          ],
        });
      }),
    ],
  });

  const questionHeader = (firstColumnTitle: string) =>
    new TableRow({
      children: [
        cell("№", QUESTIONS_COLUMNS.number),
        cell(firstColumnTitle, QUESTIONS_COLUMNS.question),
        cell("Правильный ответ", QUESTIONS_COLUMNS.answer),
        cell(
          "Наименование дисциплины, формирующей данную компетенцию",
          QUESTIONS_COLUMNS.discipline
        ),
      ],
    });

  const questionRow = (idx: number, question: AssessmentQuestion | undefined) =>
    new TableRow({
      children: [
        cell(`${idx}.`, QUESTIONS_COLUMNS.number),
        cell(question?.text ?? "", QUESTIONS_COLUMNS.question),
        cell(question?.answer ?? "", QUESTIONS_COLUMNS.answer),
        cell(question?.discipline ?? "", QUESTIONS_COLUMNS.discipline),
      ],
    });

  const openTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [
      QUESTIONS_COLUMNS.number,
      QUESTIONS_COLUMNS.question,
      QUESTIONS_COLUMNS.answer,
      QUESTIONS_COLUMNS.discipline,
    ],
    rows: [
      questionHeader("Содержание вопроса"),
      ...Array.from({ length: openRowsCount }, (_, idx) =>
        questionRow(idx + 1, data.openQuestions[idx])
      ),
    ],
  });

  const closedTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [
      QUESTIONS_COLUMNS.number,
      QUESTIONS_COLUMNS.question,
      QUESTIONS_COLUMNS.answer,
      QUESTIONS_COLUMNS.discipline,
    ],
    rows: [
      questionHeader("Содержание вопроса и варианты ответов"),
      ...Array.from({ length: closedRowsCount }, (_, idx) =>
        questionRow(openRowsCount + idx + 1, data.closedQuestions[idx])
      ),
    ],
  });

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1000,
              bottom: 1000,
              left: 1400,
            },
          },
        },
        children: [
          paragraph(data.competence, {
            bold: true,
            before: 0,
            after: SP.afterTitle,
          }),
          paragraph("Список направлений, имеющих компетенцию во ФГОС:", {
            before: 0,
            after: SP.afterDirectionsIntro,
          }),
          directionsTable,
          spacerParagraph(SP.afterDirectionsTable, 0),
          paragraph(
            "Типовые задания или иные материалы, необходимые для диагностической работы оценки результатов обучения, характеризующих этапы формирования общепрофессиональных компетенций:",
            { before: 0, after: SP.afterTasksIntro }
          ),
          paragraph("Перечень открытых вопросов", {
            before: 0,
            after: SP.afterOpenListTitle,
          }),
          openTable,
          spacerParagraph(SP.beforeClosedListTitle, 0),
          paragraph("Перечень закрытых (тестовых) вопросов", {
            before: 0,
            after: SP.afterClosedListTitle,
          }),
          closedTable,
        ],
      },
    ],
  });
}

class RpdProfileTemplatesController {
  model: RpdProfileTemplates;
  constructor(pool: Pool) {
    this.model = new RpdProfileTemplates(pool);
  }

  async getJsonProfile(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { id } = req.body;
      const value = await this.model.getJsonProfile(id);
      if (!value) {
        return res.status(404).json({ message: "Шаблон не найден" });
      }
      const fieldChanges = await getLatestFieldChanges(value.id);
      res.json({ ...value, fieldChanges, study_plan_hours: getStudyPlanHours(value.study_load, value.control_load), derived_certification: deriveCertification(value.study_load, value.control_load) });
    } catch (err) {
      res.status(500).json({ message: errorMessage(err) });
    }
  }

  async updateById(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    const { fieldToUpdate, value, baseAt } = req.body ?? {};
    if (!isEditableTemplateField(fieldToUpdate) || !(baseAt === null || typeof baseAt === "string")) {
      throw new Unprocessable("Укажите допустимое поле и baseAt");
    }
    res.json(await this.model.updateById(req.params.id, fieldToUpdate, value, baseAt, TemplateAccess.actor(req.user).id));
  }

  async updateStudyLoad(req: Request<ParamsDictionary, unknown, { hours?: Partial<Record<"all" | "lectures" | "seminars" | "control" | "independent_work", number>>; zet?: number }>, res: Response) {
    const updated = await this.model.updateStudyLoad(req.params.id, req.body.hours, req.body.zet, TemplateAccess.actor(req.user).id);
    if (!updated) return res.status(404).json({ message: "Шаблон не найден" });
    return res.json({ study_load: updated.study_load, zet: updated.zet,
      study_plan_hours: getStudyPlanHours(updated.study_load, updated.control_load), edits: updated.edits });
  }

  async upsetTemplateComment(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const commentatorId = req.user?.id;
      if (!commentatorId) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      const { field, value } = req.body;
      if (!field) {
        return res.status(400).json({ message: "Не указано поле" });
      }

      const updatedItem = await this.model.upsetTemplateComment(
        req.params.id,
        commentatorId,
        field as string,
        value
      );

      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
      console.error(error);
    }
  }

  async deleteTemplateComment(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const deleteResult = await this.model.deleteTemplateComment(
        req.params.id
      );

      if (!deleteResult) {
        return res.status(404).json({
          message: "Комментарий не найден",
        });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
      console.error(error);
    }
  }

  async copyTemplateData(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { sourceTemplateId, targetTemplateId, fieldToCopy } = req.body;

      if (!sourceTemplateId || !targetTemplateId || !fieldToCopy) {
        return res.status(400).json({
          message: "Нет необходимых параметров",
        });
      }
      if (!isEditableTemplateField(fieldToCopy)) {
        return res.status(400).json({ message: "Недопустимое поле шаблона" });
      }

      const result = await this.model.copyTemplateData(
        sourceTemplateId,
        targetTemplateId,
        fieldToCopy as string,
        TemplateAccess.actor(req.user).id
      );

      res.json(result);
    } catch (err) {
      console.error("Ошибка контроллера:", err);
      res.status(500).json({ message: errorMessage(err) });
    }
  }

  async copyTemplateContent(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { sourceTemplateId, targetTemplateId } = req.body;

      if (!sourceTemplateId || !targetTemplateId) {
        return res.status(400).json({
          message: "Нет необходимых параметров",
        });
      }

      const sourceId = await this.model.resolveTemplateId(sourceTemplateId);
      const targetId = await this.model.resolveTemplateId(targetTemplateId);
      if (sourceId != null && targetId != null && sourceId === targetId) {
        return res.status(400).json({
          message: "Нельзя импортировать шаблон сам в себя",
        });
      }

      const result = await this.model.copyTemplateContent(
        sourceTemplateId,
        targetTemplateId,
        TemplateAccess.actor(req.user).id
      );

      res.json(result);
    } catch (err) {
      console.error("Ошибка контроллера:", err);
      res.status(500).json({ message: errorMessage(err) });
    }
  }

  async getChangeableValues(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
      const { ids, rowName } = req.query;
      if (!ids || !rowName) throw new Unprocessable("Укажите ids и rowName");
      const result = await this.model.getChangeableValues(ids, rowName, TemplateAccess.actor(req.user));
      res.json(result);
  }

  async generateAssessmentFundsDocx(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { complectId, competence } = req.body;
      if (!complectId || !competence) {
        return res.status(400).json({ message: "Нет необходимых параметров" });
      }

      const data = await this.model.getAssessmentFundsDocumentData(
        complectId,
        competence as string
      );

      if (!data) {
        return res.status(404).json({ message: "Комплект не найден" });
      }

      const doc = buildAssessmentFundsDoc(data);
      const buffer = await Packer.toBuffer(doc);
      const filename = `${String(competence).slice(0, 80)}.docx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.send(buffer);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: errorMessage(error) });
    }
  }

  async generateAssessmentFundsXlsx(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    const complectId = req.body.complectId;
    if (typeof complectId !== "string" && typeof complectId !== "number" || String(complectId).trim() === "") throw new Unprocessable("Укажите complectId");
    const data = await this.model.getAssessmentFundsWorkbookData(complectId);
    if (!data) throw new NotFound("Комплект не найден");
    const { direction, profile, year } = data.complect;
    const buffer = await buildFosWorkbook({ direction, profile, year, rows: fosRows(data.templates) });
    const filename = profile?.trim() && year !== null ? `ФОС ${profile.trim().replace(/[\\/:*?"<>|\r\n]/g, " ")} ${year}.xlsx` : "ФОС.xlsx";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }
}

export default RpdProfileTemplatesController;
