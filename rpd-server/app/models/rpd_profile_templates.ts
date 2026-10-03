import type { RpdComplectRow, RpdProfileTemplateRow } from "../types/db.ts";
import type { Pool } from "pg";
import { patchStudyLoad } from "../modules/disciplineScope.ts";
import { isEditableTemplateField } from "../validators/RpdProfileTemplates.ts";
import { fullnameText } from "../modules/teacherNames.ts";
import { selectedFundsQuestions } from "../modules/assessmentFunds.ts";
import { fieldEditsSet, withEditorNames } from "../modules/fieldEdits.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import type { UserClaims } from "../types/express.d.ts";
import { Conflict, Forbidden, NotFound, Unprocessable } from "../utils/Errors.ts";

const commentatorFullnameSql = `COALESCE(NULLIF(CONCAT_WS(' ',
  NULLIF(BTRIM(u.fullname ->> 'surname'), ''),
  NULLIF(BTRIM(u.fullname ->> 'name'), ''),
  NULLIF(BTRIM(u.fullname ->> 'patronymic'), '')
), ''), u.name, '—')`;

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
                (to_jsonb(tfc) - 'template_field' - 'id_profile_template') ||
                  jsonb_build_object('commentator_fullname', ${commentatorFullnameSql})
              ) AS comments
        FROM template_field_comment tfc
        LEFT JOIN users u ON u.id = tfc.commentator_id
        WHERE tfc.id_profile_template = rpt.id
      ) c ON true
      WHERE rpt.id = $1;
    `,
      [numericId]
    );
    const profile = queryResult.rows[0];
    if (!profile) return null;
    const { rows: teachers } = await this.pool.query<{ userId: number; name: string; fullname: unknown; isActive: boolean }>(`
      SELECT u.id AS "userId",u.name,u.fullname,u.is_active AS "isActive"
      FROM teacher_templates tt JOIN users u ON u.id=tt.user_id
      WHERE tt.template_id=$1 ORDER BY tt.id
    `, [numericId]);
    return { ...profile, field_edits: await withEditorNames(this.pool, profile.field_edits), teachers: teachers.map((teacher) => ({ userId: teacher.userId, fullname: fullnameText(teacher.fullname) || teacher.name, isActive: teacher.isActive })) };
  }

  async updateById(id: unknown, fieldToUpdate: string, value: unknown, baseAt: string | null, userId: number) {
    if (!isEditableTemplateField(fieldToUpdate)) throw new Unprocessable("Недопустимое поле шаблона");
    const numericId = await this.resolveTemplateId(id);
    if (numericId == null) throw new NotFound("Шаблон не найден");
    const preparedValue =
      RpdProfileTemplates.JSONB_FIELDS.has(fieldToUpdate) &&
      value !== null &&
      value !== undefined
        ? JSON.stringify(value)
        : value;

    const queryResult = await this.pool.query<{ value: unknown; edit: RpdProfileTemplateRow["field_edits"][string] }>(
      `UPDATE rpd_profile_templates SET ${fieldToUpdate} = $1, ${fieldEditsSet(5, 6)} WHERE id = $2 AND (field_edits -> $3 ->> 'at') IS NOT DISTINCT FROM $4 RETURNING ${fieldToUpdate} AS value, field_edits -> $3 AS edit`,
      [preparedValue, numericId, fieldToUpdate, baseAt, userId, [fieldToUpdate]]
    );
    if (!queryResult.rows[0]) {
      const { rows } = await this.pool.query<{ value: unknown; edit: RpdProfileTemplateRow["field_edits"][string] | null }>(
        `SELECT ${fieldToUpdate} AS value, field_edits -> $2 AS edit FROM rpd_profile_templates WHERE id = $1`,
        [numericId, fieldToUpdate]
      );
      if (!rows[0]) throw new NotFound("Шаблон не найден");
      const edit = (await withEditorNames(this.pool, rows[0].edit ? { [fieldToUpdate]: rows[0].edit } : {}))[fieldToUpdate] ?? null;
      throw new Conflict({ message: "Поле уже изменено", field: fieldToUpdate, value: rows[0].value, edit });
    }
    const edit = (await withEditorNames(this.pool, { [fieldToUpdate]: queryResult.rows[0].edit }))[fieldToUpdate];
    return { field: fieldToUpdate, value: queryResult.rows[0].value, edit };
  }

  async updateStudyLoad(id: unknown, hours: Partial<Record<"all" | "lectures" | "seminars" | "control" | "independent_work", number>> | undefined, zet: number | undefined, userId: number) {
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
      const fields = [...(hours ? ["study_load"] : []), ...(zet === undefined ? [] : ["zet"])];
      const sets: string[] = [];
      const values: unknown[] = [];
      if (hours) {
        values.push(JSON.stringify(patchStudyLoad(current.rows[0].study_load, hours)));
        sets.push(`study_load = $${values.length}`);
      }
      if (zet !== undefined) {
        values.push(zet);
        sets.push(`zet = $${values.length}`);
      }
      values.push(userId, fields, numericId);
      sets.push(fieldEditsSet(values.length - 2, values.length - 1));
      const result = await client.query<Pick<RpdProfileTemplateRow, "study_load" | "control_load" | "zet" | "field_edits">>(
        `UPDATE rpd_profile_templates SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING study_load, control_load, zet, field_edits`,
        values
      );
      await client.query("COMMIT");
      if (!result.rows[0]) return null;
      const edits = await withEditorNames(this.pool, Object.fromEntries(fields.map((field) => [field, result.rows[0].field_edits[field]])));
      return { ...result.rows[0], edits };
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
      `WITH saved AS (INSERT INTO template_field_comment (
        id_profile_template,
        commentator_id,
        template_field,
        comment_text
      ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_profile_template, template_field)
       DO UPDATE SET 
        comment_text = EXCLUDED.comment_text,
        commentator_id = EXCLUDED.commentator_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *)
      SELECT saved.*, ${commentatorFullnameSql} AS commentator_fullname
      FROM saved LEFT JOIN users u ON u.id = saved.commentator_id
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

  async copyTemplateData(sourceTemplateId: unknown, targetTemplateId: unknown, fieldToCopy: string, userId: number) {
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
        `UPDATE rpd_profile_templates SET ${fieldToCopy} = $1, ${fieldEditsSet(3, 4)} WHERE id = $2 RETURNING *`,
        [nextValue, targetId, userId, [fieldToCopy]]
      );
      const targetTemplate = updateResult.rows[0];
      const edit = (await withEditorNames(this.pool, { [fieldToCopy]: targetTemplate.field_edits[fieldToCopy] }))[fieldToCopy];

      return {
        success: true,
        message: `Поле ${fieldToCopy} успешно скопировано`,
        targetTemplate,
        value: targetTemplate[fieldToCopy as keyof RpdProfileTemplateRow],
        edit,
      };
    } catch (error) {
      console.error("Ошибка копирования:", error);
      throw error;
    }
  }

  async copyTemplateContent(sourceTemplateId: unknown, targetTemplateId: unknown, userId: number) {
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
          SET ${setClause}, ${fieldEditsSet(fields.length + 2, fields.length + 3)}
          WHERE id = $${fields.length + 1}
          RETURNING *;
        `,
        [...nextValues, targetId, userId, fields]
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

    const openQuestions: { text: string; answer: string; discipline: string | null }[] = [];
    const closedQuestions: { text: string; answer: string; discipline: string | null }[] = [];
    for (const row of questionsResult.rows) {
      const selected = selectedFundsQuestions(row.assessment_tools_questions, competence);
      openQuestions.push(...selected.open.map((question) => ({ ...question, discipline: row.disciplins_name })));
      closedQuestions.push(...selected.closed.map((question) => ({ ...question, discipline: row.disciplins_name })));
    }

    return {
      competence,
      complect,
      directions: directionsResult.rows,
      openQuestions,
      closedQuestions,
    };
  }

  async getAssessmentFundsWorkbookData(complectId: unknown) {
    const { rows: complects } = await this.pool.query<Pick<RpdComplectRow, "id" | "direction" | "profile" | "year">>(`
      SELECT id,direction,profile,year FROM rpd_complects
      WHERE id::text=$1::text OR uuid::text=$1::text LIMIT 1
    `, [String(complectId)]);
    const complect = complects[0];
    if (!complect) return null;
    const { rows: templates } = await this.pool.query<Pick<RpdProfileTemplateRow, "disciplins_name" | "semester" | "assessment_tools_questions">>(`
      SELECT disciplins_name,semester,assessment_tools_questions FROM rpd_profile_templates
      WHERE id_rpd_complect=$1 AND assessment_tools_questions IS NOT NULL ORDER BY id
    `, [complect.id]);
    return { complect, templates };
  }
}

export default RpdProfileTemplates;
