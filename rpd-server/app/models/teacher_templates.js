const moment = require("moment");

class TeacherTemplates {
  constructor(pool) {
    this.pool = pool;
  }

  async bindTemplateWithTeacher(id, teacher, userName) {
    try {
      const fullname = teacher.split(" ");
      const nameParam = {
        name: fullname[1],
        surname: fullname[0],
        patronymic: fullname[2],
      };

      const userIdResult = await this.pool.query(
        `
                SELECT id FROM users WHERE fullname = $1
            `,
        [nameParam]
      );

      if (!userIdResult.rows[0]) return "UserNotFound";
      const userId = userIdResult.rows[0].id;

      const teacherTemplateRowResult = await this.pool.query(
        `
                SELECT id from teacher_templates 
                WHERE user_id = $1 and template_id = $2
            `,
        [userId, id]
      );

      if (teacherTemplateRowResult.rows[0]) return "TemplateAlreadyBinned";

      await this.pool.query(
        `
                INSERT INTO teacher_templates (
                    user_id, template_id
                ) VALUES (
                    $1, $2
                )
            `,
        [userId, id]
      );

      await this.setTemplateStatus(id, userName, "on_teacher");

      return "binnedSuccess";
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async findTeacherTemplates(userName) {
    try {
      const fullname = userName.split(" ");
      const nameParam = {
        name: fullname[1],
        surname: fullname[0],
        patronymic: fullname[2],
      };

      const userIdResult = await this.pool.query(
        `
                SELECT id FROM users WHERE fullname = $1
            `,
        [nameParam]
      );

      if (!userIdResult.rows[0]) return "UserNotFound";
      const userId = userIdResult.rows[0].id;

      const result = await this.pool.query(
        `
                SELECT rpt.id, rpt.disciplins_name, rc.faculty,
                rc.direction, rc.profile, rc.education_level,
                rc.education_form, rc.year, (
                    SELECT status
                    FROM jsonb_array_elements((
                        SELECT history 
                        FROM template_status 
                        WHERE id_profile_template = rpt.id 
                        LIMIT 1
                    )) AS elem(status)
                    ORDER BY elem DESC
                    LIMIT 1
                )
                FROM rpd_profile_templates rpt
                JOIN rpd_complects rc ON rc.id = rpt.id_rpd_complect
                WHERE rpt.id IN (
                    SELECT template_id
                    FROM teacher_templates
                    WHERE user_id = $1
                )
                OR rpt.teacher = $2
                OR rpt.teacher LIKE '%' || $2 || '%'
                ;`,
        [userId, userName]
      );

      return result.rows;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async setTemplateStatus(id, userName, status) {
    try {
      const statusLog = {
        date: moment().format(),
        status,
        user: userName,
      };

      await this.pool.query(
        `
                  UPDATE template_status
                  SET history = history || $1::jsonb
                  WHERE id_profile_template = $2
                  `,
        [statusLog, id]
      );

      return "success";
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

}

module.exports = TeacherTemplates;
