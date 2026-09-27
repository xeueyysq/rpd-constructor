import type { RpdComplectRow, RpdProfileTemplateRow } from "../types/db.ts";
import type { Pool } from "pg";
import { patchStudyLoad } from "../modules/disciplineScope.ts";
import { isEditableTemplateField } from "../validators/RpdProfileTemplates.ts";
import { fullnameText } from "../modules/teacherNames.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import type { UserClaims } from "../types/express.d.ts";
import { Forbidden, Unprocessable } from "../utils/Errors.ts";

type AssessmentQuestionEntry = { id: string; text: string; correctAnswer?: string };
type AssessmentCompetence = { openPool?: AssessmentQuestionEntry[]; closedPool?: AssessmentQuestionEntry[]; openQuestions?: unknown; closedQuestions?: unknown; selectedOpenIds?: string[]; selectedClosedIds?: string[] };
type AssessmentFundsJson = { competencies?: Record<string, AssessmentCompetence> };

class RpdProfileTemplates {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  static JSONB_FIELDS = new Set([
    "competencies",
    "content",
    "study_load",
    "control_load",
    "assessment_tools_questions",
  ]);
  static TEXT_APPEND_SEPARATOR = "<p></p>";
  static CONTENT_COPY_FIELDS = [
    "protocol",
    "goals",
    "place_more_text",
    "competencies",
    "content",
    "content_more_text",
    "content_template_more_text",
    "methodological_support_template",
    "assessment_tools_template",
    "assessment_tools_questions",
    "textbook",
    "additional_textbook",
    "professional_information_resources",
    "software",
    "logistics_template",
  ];

  mergeFieldValue(fieldName: string, targetValue: unknown, sourceValue: unknown) {
    if (RpdProfileTemplates.JSONB_FIELDS.has(fieldName)) {
      return sourceValue;
    }

    if (typeof sourceValue !== "string") {
      return sourceValue;
    }

    const sourceTrimmed = sourceValue.trim();
    if (!sourceTrimmed) {
      return targetValue ?? sourceValue;
    }

    const targetString = typeof targetValue === "string" ? targetValue : "";
    const targetTrimmed = targetString.trim();

    if (!targetTrimmed) {
      return sourceValue;
    }

    return `${targetString}${RpdProfileTemplates.TEXT_APPEND_SEPARATOR}${sourceValue}`;
  }

  async resolveTemplateId(identifier: unknown) {
    if (identifier == null || identifier === "") return null;
    const { rows } = await this.pool.query<{ id: number }>(
      `
      SELECT id FROM rpd_profile_templates
      WHERE id::text = $1::text OR public_id = $1
      LIMIT 1
      `,
      [String(identifier)]
    );
    return rows[0]?.id ?? null;
  }

  async getJsonProfile(id: unknown) {
    const numericId = await this.resolveTemplateId(id);
    if (numericId == null) return null;
    const queryResult = await this.pool.query<RpdProfileTemplateRow & Pick<RpdComplectRow, "faculty" | "direction" | "profile" | "education_level" | "education_form" | "year"> & { complect_uuid: string; comments: unknown }>(
      `
      SELECT
        rpt.*,
        rc.faculty,
        rc.direction,
        rc.profile,
        rc.education_level,
        rc.education_form,
        rc.year,
        rc.uuid AS complect_uuid,
        COALESCE(c.comments, '{}'::jsonb) AS comments
      FROM rpd_profile_templates rpt
      JOIN rpd_complects rc ON rc.id = rpt.id_rpd_complect
      LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(
                tfc.template_field,
                to_jsonb(tfc) - 'template_field' - 'id_1c_template'
              ) AS comments
        FROM template_field_comment tfc
        WHERE tfc.id_1c_template = rpt.id
      ) c ON true
      WHERE rpt.id = $1;
    `,
      [numericId]
    );
    const profile = queryResult.rows[0];
    if (!profile) return null;
    const { rows: teachers } = await this.pool.query<{ userId: number; fullname: unknown; isActive: boolean }>(`
      SELECT u.id AS "userId",u.fullname,u.is_active AS "isActive"
      FROM teacher_templates tt JOIN users u ON u.id=tt.user_id
      WHERE tt.template_id=$1 ORDER BY tt.id
    `, [numericId]);
    return { ...profile, teachers: teachers.map((teacher) => ({ userId: teacher.userId, fullname: fullnameText(teacher.fullname), isActive: teacher.isActive })) };
  }

  async updateById(id: unknown, fieldToUpdate: string, value: unknown) {
    if (!isEditableTemplateField(fieldToUpdate)) throw new Error("Недопустимое поле шаблона");
    const numericId = await this.resolveTemplateId(id);
    if (numericId == null) return null;
    const preparedValue =
      RpdProfileTemplates.JSONB_FIELDS.has(fieldToUpdate) &&
      value !== null &&
      value !== undefined
        ? JSON.stringify(value)
        : value;

    const queryResult = await this.pool.query<RpdProfileTemplateRow>(
      `UPDATE rpd_profile_templates SET ${fieldToUpdate} = $1 WHERE id = $2 RETURNING *`,
      [preparedValue, numericId]
    );
    return queryResult.rows[0];
  }

  async updateStudyLoad(id: unknown, hours: Partial<Record<"all" | "lectures" | "seminars" | "control" | "independent_work", number>> | undefined, zet: number | undefined) {
    const numericId = await this.resolveTemplateId(id);
    if (numericId == null) return null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<Pick<RpdProfileTemplateRow, "study_load">>(
        "SELECT study_load FROM rpd_profile_templates WHERE id = $1 FOR UPDATE", [numericId]
      );
      if (!current.rows[0]) {
        await client.query("COMMIT");
        return null;
      }
      const studyLoad = hours ? patchStudyLoad(current.rows[0].study_load, hours) : current.rows[0].study_load;
      const result = await client.query<Pick<RpdProfileTemplateRow, "study_load" | "control_load" | "zet">>(
        zet === undefined
          ? "UPDATE rpd_profile_templates SET study_load = $1 WHERE id = $2 RETURNING study_load, control_load, zet"
          : "UPDATE rpd_profile_templates SET study_load = $1, zet = $3 WHERE id = $2 RETURNING study_load, control_load, zet",
        zet === undefined ? [JSON.stringify(studyLoad), numericId] : [JSON.stringify(studyLoad), numericId, zet]
      );
      await client.query("COMMIT");
      return result.rows[0] ?? null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async upsetTemplateComment(templateId: unknown, commentatorId: unknown, field: unknown, value: unknown) {
    const numericTemplateId = await this.resolveTemplateId(templateId);
    if (numericTemplateId == null) return null;
    const preparedValue =
      value === null || value === undefined
        ? null
        : typeof value === "string"
          ? value
          : JSON.stringify(value);

    const queryResult = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO template_field_comment (
        id_1c_template,
        commentator_id,
        template_field,
        comment_text
      ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_1c_template, template_field)
       DO UPDATE SET 
        comment_text = EXCLUDED.comment_text,
        commentator_id = EXCLUDED.commentator_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [numericTemplateId, commentatorId, field, preparedValue]
    );

    return queryResult.rows[0];
  }

  async deleteTemplateComment(commentId: unknown) {
    const queryResult = await this.pool.query(
      `DELETE FROM template_field_comment WHERE id = $1 RETURNING *`,
      [commentId]
    );
    return queryResult.rowCount;
  }

  async copyTemplateData(sourceTemplateId: unknown, targetTemplateId: unknown, fieldToCopy: string) {
    if (!isEditableTemplateField(fieldToCopy)) throw new Error("Недопустимое поле шаблона");
    try {
      const sourceId = await this.resolveTemplateId(sourceTemplateId);
      const targetId = await this.resolveTemplateId(targetTemplateId);
      if (sourceId == null || targetId == null) {
        throw new Error("Шаблон не найден");
      }
      const sourceTemplateResult = await this.pool.query<Record<string, unknown>>(
        `SELECT ${fieldToCopy} FROM rpd_profile_templates WHERE id = $1`,
        [sourceId]
      );
      const targetTemplateResult = await this.pool.query<Record<string, unknown>>(
        `SELECT ${fieldToCopy} FROM rpd_profile_templates WHERE id = $1`,
        [targetId]
      );

      const sourceValue = sourceTemplateResult.rows[0]?.[fieldToCopy];
      const targetValue = targetTemplateResult.rows[0]?.[fieldToCopy];
      if (sourceTemplateResult.rows.length === 0)
        throw new Error("Исходный шаблон не найден");

      const nextValue = this.mergeFieldValue(
        fieldToCopy,
        targetValue,
        sourceValue
      );
      const updateResult = await this.pool.query<RpdProfileTemplateRow>(
        `UPDATE rpd_profile_templates SET ${fieldToCopy} = $1 WHERE id = $2 RETURNING *`,
        [nextValue, targetId]
      );

      return {
        success: true,
        message: `Поле ${fieldToCopy} успешно скопировано`,
        targetTemplate: updateResult.rows[0],
      };
    } catch (error) {
      console.error("Ошибка копирования:", error);
      throw error;
    }
  }

  async copyTemplateContent(sourceTemplateId: unknown, targetTemplateId: unknown) {
    try {
      const sourceId = await this.resolveTemplateId(sourceTemplateId);
      const targetId = await this.resolveTemplateId(targetTemplateId);
      if (sourceId == null || targetId == null) {
        throw new Error("Шаблон не найден");
      }
      const { rows: columnRows } = await this.pool.query<{ column_name: string }>(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'rpd_profile_templates';
        `
      );

      const existingColumns = new Set(columnRows.map((r) => r.column_name));
      const fields = RpdProfileTemplates.CONTENT_COPY_FIELDS.filter((f) =>
        existingColumns.has(f)
      );

      if (fields.length === 0) {
        return {
          success: false,
          message: "Нет доступных полей для импорта (проверьте схему БД)",
        };
      }

      const { rows: sourceRows } = await this.pool.query<Record<string, unknown>>(
        `SELECT ${fields.join(", ")} FROM rpd_profile_templates WHERE id = $1`,
        [sourceId]
      );
      const { rows: targetRows } = await this.pool.query<Record<string, unknown>>(
        `SELECT ${fields.join(", ")} FROM rpd_profile_templates WHERE id = $1`,
        [targetId]
      );

      if (sourceRows.length === 0 || targetRows.length === 0) {
        return {
          success: false,
          message: "Не удалось импортировать данные: шаблон не найден",
        };
      }

      const sourceRow = sourceRows[0];
      const targetRow = targetRows[0];
      const nextValues = fields.map((field) =>
        this.mergeFieldValue(field, targetRow[field], sourceRow[field])
      );
      const setClause = fields
        .map((f, idx) => `${f} = $${idx + 1}`)
        .join(", ");

      const queryResult = await this.pool.query<RpdProfileTemplateRow>(
        `
          UPDATE rpd_profile_templates
          SET ${setClause}
          WHERE id = $${fields.length + 1}
          RETURNING *;
        `,
        [...nextValues, targetId]
      );

      if (queryResult.rowCount === 0) {
        return {
          success: false,
          message: "Не удалось импортировать данные: шаблон не найден",
        };
      }

      return {
        success: true,
        message: "Контентные поля успешно импортированы",
        targetTemplate: queryResult.rows[0],
      };
    } catch (error) {
      console.error("Ошибка импорта контента:", error);
      throw error;
    }
  }

  async getChangeableValues(ids: unknown, rowName: unknown, actor: UserClaims) {
      if (!isEditableTemplateField(rowName)) throw new Unprocessable("Недопустимое поле шаблона");
      await TemplateAccess.assertActive(this.pool, actor);
      const idList = Array.isArray(ids) ? ids : [ids];
      const numericIds: number[] = [];
      for (const id of idList) {
        const n = await this.resolveTemplateId(id);
        if (n == null) continue;
        try {
          await TemplateAccess.assertTemplate(this.pool, actor, n, "read");
          numericIds.push(n);
        } catch (error) {
          if (!(error instanceof Forbidden)) throw error;
        }
      }
      if (numericIds.length === 0) return [];
      const queryResult = await this.pool.query<Pick<RpdProfileTemplateRow, "id" | "public_id"> & Record<string, unknown>>(
        `SELECT ${rowName}, id, public_id FROM rpd_profile_templates WHERE id = ANY($1)`,
        [numericIds]
      );
      return queryResult.rows;
  }

  async getAssessmentFundsDocumentData(complectId: unknown, competence: string) {
    const complectResult = await this.pool.query<RpdComplectRow>(
      `
        SELECT *
        FROM rpd_complects
        WHERE id::text = $1::text OR uuid::text = $1::text
        LIMIT 1
      `,
      [String(complectId)]
    );
    const complect = complectResult.rows[0];
    if (!complect?.id) return null;

    const directionsResult = await this.pool.query<{ direction: string | null; profile: string | null; disciplines: string[] }>(
      `
        SELECT
          rc.direction,
          rc.profile,
          array_agg(DISTINCT d.discipline ORDER BY d.discipline) AS disciplines
        FROM planned_results_sets prs
        JOIN rpd_complects rc ON rc.id = prs.complect_id
        JOIN planned_competencies pc ON pc.set_id = prs.id
        JOIN planned_indicators pi ON pi.competence_id = pc.id
        JOIN planned_indicator_disciplines d ON d.indicator_id = pi.id
        WHERE pc.competence = $1
        GROUP BY rc.id, rc.direction, rc.profile
        ORDER BY rc.direction, rc.profile
      `,
      [competence]
    );

    const questionsResult = await this.pool.query<Pick<RpdProfileTemplateRow, "disciplins_name" | "assessment_tools_questions">>(
      `
        SELECT disciplins_name, assessment_tools_questions
        FROM rpd_profile_templates
        WHERE id_rpd_complect = $1
          AND assessment_tools_questions IS NOT NULL
      `,
      [complect.id]
    );

    const openQuestions = [];
    const closedQuestions = [];
    const parseLegacyQuestions = (value: unknown): AssessmentQuestionEntry[] =>
      typeof value === "string"
        ? value
            .split(/\r?\n+/)
            .map((text) => text.trim())
            .filter(Boolean)
            .map((text, idx) => ({ id: `legacy_${idx}`, text }))
        : [];

    for (const row of questionsResult.rows) {
      const fundsValue: unknown = row.assessment_tools_questions;
      const funds = fundsValue && typeof fundsValue === "object" && !Array.isArray(fundsValue) ? fundsValue as AssessmentFundsJson : {};
      const item = funds?.competencies?.[competence];
      if (!item) continue;

      const openPool =
        Array.isArray(item.openPool) && item.openPool.length
          ? item.openPool
          : parseLegacyQuestions(item.openQuestions);
      const closedPool =
        Array.isArray(item.closedPool) && item.closedPool.length
          ? item.closedPool
          : parseLegacyQuestions(item.closedQuestions);
      const selectedOpen = new Set(
        Array.isArray(item.selectedOpenIds)
          ? item.selectedOpenIds
          : openPool.map((question: { id: string }) => question.id)
      );
      const selectedClosed = new Set(
        Array.isArray(item.selectedClosedIds)
          ? item.selectedClosedIds
          : closedPool.map((question: { id: string }) => question.id)
      );

      for (const question of openPool) {
        if (!selectedOpen.has(question.id)) continue;
        openQuestions.push({
          text: question.text,
          answer:
            typeof question.correctAnswer === "string"
              ? question.correctAnswer
              : "",
          discipline: row.disciplins_name,
        });
      }

      for (const question of closedPool) {
        if (!selectedClosed.has(question.id)) continue;
        closedQuestions.push({
          text: question.text,
          answer:
            typeof question.correctAnswer === "string"
              ? question.correctAnswer
              : "",
          discipline: row.disciplins_name,
        });
      }
    }

    return {
      competence,
      complect,
      directions: directionsResult.rows,
      openQuestions,
      closedQuestions,
    };
  }
}

export default RpdProfileTemplates;
