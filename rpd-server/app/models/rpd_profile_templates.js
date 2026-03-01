const moment = require("moment");

class RpdProfileTemplates {
  constructor(pool) {
    this.pool = pool;
  }

  static JSONB_FIELDS = new Set([
    "competencies",
    "content",
    "study_load",
    "control_load",
  ]);
  static CONTENT_COPY_FIELDS = [
    "protocol",
    "goals",
    "place_more_text",
    "certification",
    "competencies",
    "content",
    "content_more_text",
    "content_template_more_text",
    "methodological_support_template",
    "assessment_tools_template",
    "textbook",
    "additional_textbook",
    "professional_information_resources",
    "software",
    "logistics_template",
  ];

  async resolveTemplateId(identifier) {
    if (identifier == null || identifier === "") return null;
    const { rows } = await this.pool.query(
      `
      SELECT id FROM rpd_profile_templates
      WHERE id::text = $1::text OR public_id = $1
      LIMIT 1
      `,
      [String(identifier)]
    );
    return rows[0]?.id ?? null;
  }

  async getJsonProfile(id) {
    const numericId = await this.resolveTemplateId(id);
    if (numericId == null) return null;
    const queryResult = await this.pool.query(
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
    return queryResult.rows[0];
  }

  async updateById(id, fieldToUpdate, value) {
    const numericId = await this.resolveTemplateId(id);
    if (numericId == null) return null;
    const preparedValue =
      RpdProfileTemplates.JSONB_FIELDS.has(fieldToUpdate) &&
      value !== null &&
      value !== undefined
        ? JSON.stringify(value)
        : value;

    const queryResult = await this.pool.query(
      `UPDATE rpd_profile_templates SET ${fieldToUpdate} = $1 WHERE id = $2 RETURNING *`,
      [preparedValue, numericId]
    );
    return queryResult.rows[0];
  }

  async upsetTemplateComment(templateId, commentatorId, field, value) {
    const numericTemplateId = await this.resolveTemplateId(templateId);
    if (numericTemplateId == null) return null;
    const preparedValue =
      value === null || value === undefined
        ? null
        : typeof value === "string"
          ? value
          : JSON.stringify(value);

    const queryResult = await this.pool.query(
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

  async deleteTemplateComment(commentId) {
    const queryResult = await this.pool.query(
      `DELETE FROM template_field_comment WHERE id = $1 RETURNING *`,
      [commentId]
    );
    return queryResult.rowCount;
  }

  async findByCriteria(
    faculty,
    levelEducation,
    directionOfStudy,
    profile,
    formEducation,
    year
  ) {
    const queryResult = await this.pool.query(
      `
      SELECT id, disciplins_name, teacher, (
        SELECT status FROM 
        jsonb_array_elements((
          SELECT history 
          FROM template_status 
          WHERE id_profile_template = rpd_profile_templates.id
          LIMIT 1
        )) AS elem(status)
        ORDER BY elem DESC
        LIMIT 1
      )
      FROM rpd_profile_templates
      WHERE faculty = $1 
      AND level_education = $2 
      AND direction_of_study = $3
      AND profile = $4 
      AND form_education = $5 
      AND year = $6`,
      [faculty, levelEducation, directionOfStudy, profile, formEducation, year]
    );
    return queryResult.rows;
  }

  async findOrCreateByDisciplineAndYear(
    disciplinsName,
    id,
    currentYear,
    userName
  ) {
    try {
      const searchResult = await this.pool.query(
        `
            SELECT * FROM rpd_profile_templates
            WHERE disciplins_name = $1 AND year = $2
          `,
        [disciplinsName, currentYear]
      );

      if (searchResult.rowCount > 0) {
        return {
          status: "record exists",
          data: searchResult.rows[0].id,
        };
      } else {
        const numericId = await this.resolveTemplateId(id);
        if (numericId == null) throw new Error("Existing record not found");
        const existingRecordResult = await this.pool.query(
          `
              SELECT * FROM rpd_profile_templates WHERE id = $1
            `,
          [numericId]
        );
        const existingRecord = existingRecordResult.rows[0];
        if (!existingRecord) {
          throw new Error("Existing record not found");
        }

        const addingRecord = await this.pool.query(
          `
          INSERT INTO rpd_profile_templates (
            disciplins_name, 
            year, 
            faculty, 
            department, 
            direction_of_study, 
            profile,
            level_education, 
            form_education, 
            teacher, 
            protocol, 
            goals, 
            place,
            semester, 
            certification, 
            place_more_text, 
            competencies, 
            zet, 
            content,
            content_more_text, 
            content_template_more_text, 
            methodological_support_template,
            assessment_tools_template, 
            textbook, 
            additional_textbook, 
            professional_information_resources,
            software, 
            logistics_template
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27
          ) RETURNING id
          `,
          [
            disciplinsName,
            currentYear,
            existingRecord.faculty,
            existingRecord.department,
            existingRecord.direction_of_study,
            existingRecord.profile,
            existingRecord.level_education,
            existingRecord.form_education,
            existingRecord.teacher,
            existingRecord.protocol,
            existingRecord.goals,
            existingRecord.place,
            existingRecord.semester,
            existingRecord.certification,
            existingRecord.place_more_text,
            existingRecord.competencies,
            existingRecord.zet,
            existingRecord.content,
            existingRecord.content_more_text,
            existingRecord.content_template_more_text,
            existingRecord.methodological_support_template,
            existingRecord.assessment_tools_template,
            existingRecord.textbook,
            existingRecord.additional_textbook,
            existingRecord.professional_information_resources,
            existingRecord.software,
            existingRecord.logistics_template,
          ]
        );

        const insertedId = addingRecord.rows[0].id;
        const history = [
          {
            date: moment().format(),
            status: "created",
            user: userName,
          },
        ];

        await this.pool.query(`
          INSERT INTO template_status (id_profile_template, history) 
          VALUES (${JSON.stringify(insertedId)}, '${JSON.stringify(history)}')
        `);

        return "template created";
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async copyTemplateData(sourceTemplateId, targetTemplateId, fieldToCopy) {
    try {
      const sourceId = await this.resolveTemplateId(sourceTemplateId);
      const targetId = await this.resolveTemplateId(targetTemplateId);
      if (sourceId == null || targetId == null) {
        throw new Error("Шаблон не найден");
      }
      const sourceTemplateResult = await this.pool.query(
        `SELECT ${fieldToCopy} FROM rpd_profile_templates WHERE id = $1`,
        [sourceId]
      );

      const sourceValue = sourceTemplateResult.rows[0]?.[fieldToCopy];
      if (sourceTemplateResult.rows.length === 0)
        throw new Error("Исходный шаблон не найден");

      const updateResult = await this.pool.query(
        `UPDATE rpd_profile_templates SET ${fieldToCopy} = $1 WHERE id = $2 RETURNING *`,
        [sourceValue, targetId]
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

  async copyTemplateContent(sourceTemplateId, targetTemplateId) {
    try {
      const sourceId = await this.resolveTemplateId(sourceTemplateId);
      const targetId = await this.resolveTemplateId(targetTemplateId);
      if (sourceId == null || targetId == null) {
        throw new Error("Шаблон не найден");
      }
      const { rows: columnRows } = await this.pool.query(
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

      const setClause = fields.map((f) => `${f} = source.${f}`).join(", ");

      const queryResult = await this.pool.query(
        `
          UPDATE rpd_profile_templates AS target
          SET ${setClause}
          FROM rpd_profile_templates AS source
          WHERE source.id = $1 AND target.id = $2
          RETURNING target.*;
        `,
        [sourceId, targetId]
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

  async getChangeableValues(ids, rowName) {
    try {
      const idList = Array.isArray(ids) ? ids : [ids];
      const numericIds = [];
      for (const id of idList) {
        const n = await this.resolveTemplateId(id);
        if (n != null) numericIds.push(n);
      }
      if (numericIds.length === 0) return [];
      const queryResult = await this.pool.query(
        `SELECT ${rowName}, id, public_id FROM rpd_profile_templates WHERE id = ANY($1)`,
        [numericIds]
      );
      return queryResult.rows;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

module.exports = RpdProfileTemplates;
