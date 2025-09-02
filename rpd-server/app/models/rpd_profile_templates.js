const moment = require("moment");

class RpdProfileTemplates {
  constructor(pool) {
    this.pool = pool;
  }

  async getJsonProfile(id) {
    const queryResult = await this.pool.query(
      `
      SELECT rpt.*, rc.faculty, rc.direction,
      rc.profile, rc.education_level, rc.education_form, rc.year
      FROM rpd_profile_templates rpt
      JOIN rpd_complects rc ON rc.id = rpt.id_rpd_complect
      WHERE rpt.id = $1;
    `,
      [id]
    );
    return queryResult.rows[0];
  }

  async updateById(id, fieldToUpdate, value) {
    const queryResult = await this.pool.query(
      `UPDATE rpd_profile_templates SET ${fieldToUpdate} = $1 WHERE id = $2 RETURNING *`,
      [value, id]
    );
    return queryResult.rows[0];
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
        const existingRecordResult = await this.pool.query(
          `
              SELECT * FROM rpd_profile_templates WHERE id = $1
            `,
          [id]
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
      const sourceTemplateResult = await this.pool.query(
        `SELECT ${fieldToCopy} FROM rpd_profile_templates WHERE id = $1`,
        [sourceTemplateId]
      );

      const sourceValue = sourceTemplateResult.rows[0][fieldToCopy];

      const updateResult = await this.pool.query(
        `UPDATE rpd_profile_templates SET ${fieldToCopy} = $1 WHERE id = $2 RETURNING *`,
        [sourceValue, targetTemplateId]
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

  async getChangeableValues(ids, rowName) {
    try {
      const queryResult = await this.pool.query(
        `SELECT ${rowName}, id FROM rpd_profile_templates where id = any($1)`,
        [ids]
      );
      return queryResult.rows;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

module.exports = RpdProfileTemplates;
