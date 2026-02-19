const moment = require("moment");

class Rpd1cExchange {
  constructor(pool) {
    this.pool = pool;
  }

  normalizeTeachers(teachers) {
    const list = Array.isArray(teachers) ? teachers : teachers ? [teachers] : [];
    return [...new Set(list.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean))];
  }

  teacherNameToFullnameJson(teacher) {
    const parts = typeof teacher === "string" ? teacher.trim().split(/\s+/) : [];
    return {
      surname: parts[0],
      name: parts[1],
      patronymic: parts[2],
    };
  }

  async setResultsData(data, complectId) {
    if (!complectId) {
      throw new Error("Не указан идентификатор комплекта");
    }

    if (!Array.isArray(data)) {
      throw new Error("Некорректный формат данных компетенций");
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const { rows: setRows } = await client.query(
        `
          INSERT INTO planned_results_sets (complect_id)
          VALUES ($1)
          ON CONFLICT (complect_id)
          DO UPDATE SET complect_id = EXCLUDED.complect_id
          RETURNING id
        `,
        [complectId]
      );

      const setId = setRows[0]?.id;

      if (!setId) {
        throw new Error("Не удалось создать набор планируемых результатов");
      }

      await client.query(
        `
          DELETE FROM planned_competencies
          WHERE set_id = $1
        `,
        [setId]
      );

      const competenciesMap = new Map();

      for (const row of data) {
        if (!row) continue;

        const competenceText =
          typeof row.competence === "string" ? row.competence.trim() : "";
        const indicatorText =
          typeof row.indicator === "string" ? row.indicator.trim() : "";
        const disciplines = Array.isArray(row.disciplines)
          ? row.disciplines
          : [];

        if (!competenceText || !indicatorText) {
          continue;
        }

        let competenceRecord = competenciesMap.get(competenceText);

        if (!competenceRecord) {
          const {
            rows: competenceRows,
          } = await client.query(
            `
              INSERT INTO planned_competencies (set_id, competence)
              VALUES ($1, $2)
              RETURNING id
            `,
            [setId, competenceText]
          );

          competenceRecord = {
            id: competenceRows[0]?.id,
            indicators: new Map(),
          };

          competenciesMap.set(competenceText, competenceRecord);
        }

        if (!competenceRecord?.id) {
          throw new Error(
            "Не удалось сохранить компетенцию при загрузке данных"
          );
        }

        let indicatorRecord = competenceRecord.indicators.get(indicatorText);

        if (!indicatorRecord) {
          const {
            rows: indicatorRows,
          } = await client.query(
            `
              INSERT INTO planned_indicators (competence_id, indicator)
              VALUES ($1, $2)
              RETURNING id
            `,
            [competenceRecord.id, indicatorText]
          );

          indicatorRecord = { id: indicatorRows[0]?.id };
          competenceRecord.indicators.set(indicatorText, indicatorRecord);
        }

        if (!indicatorRecord?.id) {
          throw new Error(
            "Не удалось сохранить индикатор при загрузке данных"
          );
        }

        const uniqueDisciplines = [
          ...new Set(
            disciplines
              .filter((discipline) => typeof discipline === "string")
              .map((discipline) => discipline.trim())
              .filter(Boolean)
          ),
        ];

        for (const discipline of uniqueDisciplines) {
          await client.query(
            `
              INSERT INTO planned_indicator_disciplines (indicator_id, discipline)
              VALUES ($1, $2)
            `,
            [indicatorRecord.id, discipline]
          );
        }
      }

      await client.query("COMMIT");
      return { setId };
    } catch (error) {
      await client.query("ROLLBACK");
      console.log(error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getResultsData(complectId) {
    if (!complectId) {
      throw new Error("Не указан идентификатор комплекта");
    }

    try {
      const { rows } = await this.pool.query(
        `
          SELECT 
            c.id AS competence_id,
            c.competence,
            i.id AS indicator_id,
            i.indicator,
            d.discipline
          FROM planned_results_sets prs
          JOIN planned_competencies c ON c.set_id = prs.id
          JOIN planned_indicators i ON i.competence_id = c.id
          LEFT JOIN planned_indicator_disciplines d ON d.indicator_id = i.id
          WHERE prs.complect_id = $1
          ORDER BY c.id, i.id, d.id
        `,
        [complectId]
      );

      const indicatorsMap = new Map();
      const orderedResults = [];

      for (const row of rows) {
        if (!indicatorsMap.has(row.indicator_id)) {
          const entry = {
            competence: row.competence,
            indicator: row.indicator,
            disciplines: [],
          };
          indicatorsMap.set(row.indicator_id, entry);
          orderedResults.push(entry);
        }

        if (row.discipline) {
          indicatorsMap.get(row.indicator_id).disciplines.push(row.discipline);
        }
      }

      return orderedResults;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async findRpd(complectId) {
    try {
      const queryResult = await this.pool.query(
        `
        SELECT r.id, r.discipline, r.teachers, r.teacher, 
        r.semester, ts.id_profile_template, (
          SELECT status
          FROM jsonb_array_elements((
            SELECT history 
            FROM template_status 
            WHERE id_1c_template = r.id 
            LIMIT 1
          )) AS elem(status)
          ORDER BY elem DESC
          LIMIT 1
        )
        FROM rpd_1c_exchange r
        LEFT JOIN template_status ts ON r.id = ts.id_1c_template
        WHERE r.id_rpd_complect = $1`,
        [complectId]
      );
      return queryResult.rows;
    } catch (err) {
      console.error(err);
      throw new Error("Ошибка в models/rpd_1c_exchange/findRpd");
    }
  }

  async createTemplate(id_1c, complectId, teacher, year, discipline, userName) {
    const teachers = this.normalizeTeachers(teacher);
    if (!id_1c) throw new Error("Не указан id_1c");
    if (!complectId) throw new Error("Не указан complectId");
    if (!discipline) throw new Error("Не указана дисциплина");
    if (!teachers.length) throw new Error("Не выбраны преподаватели");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: statusRows } = await client.query(
        `
          SELECT id_profile_template
          FROM template_status
          WHERE id_1c_template = $1
          LIMIT 1
        `,
        [id_1c]
      );

      if (statusRows[0]?.id_profile_template) {
        await client.query("ROLLBACK");
        return { result: "record exists" };
      }

      const templateData = await client.query(
        `
          SELECT * FROM rpd_1c_exchange
          WHERE id = $1
        `,
        [id_1c]
      );

      const resultData = templateData.rows[0];
      if (!resultData) throw new Error("Шаблон 1С не найден");

      const missingTeachers = [];
      for (const currentTeacher of teachers) {
        const fullnameJson = this.teacherNameToFullnameJson(currentTeacher);
        if (!fullnameJson?.surname || !fullnameJson?.name || !fullnameJson?.patronymic) {
          missingTeachers.push(currentTeacher);
          continue;
        }

        const { rows: userRows } = await client.query(
          `
            SELECT id
            FROM users
            WHERE fullname = $1
            LIMIT 1
          `,
          [fullnameJson]
        );

        if (!userRows[0]?.id) {
          missingTeachers.push(currentTeacher);
        }
      }

      if (missingTeachers.length) {
        await client.query("ROLLBACK");
        return { result: "missing_teachers", missingTeachers };
      }

      const competencies = {};
      const teacherString = teachers.join(", ");

      const queryResult = await client.query(
        `
          INSERT INTO rpd_profile_templates (
            id_rpd_complect,
            disciplins_name,
            department,
            teacher,
            place,
            semester,
            competencies,
            zet,
            study_load
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) RETURNING id
        `,
        [
          complectId,
          discipline,
          resultData.department,
          teacherString,
          resultData.place,
          resultData.semester,
          competencies,
          resultData.zet,
          JSON.stringify(resultData.study_load),
        ]
      );

      const idProfileTemplate = queryResult.rows[0]?.id;
      if (!idProfileTemplate) throw new Error("Не удалось создать шаблон профиля");

      await client.query(
        `
          UPDATE rpd_1c_exchange
          SET teacher = $1
          WHERE id = $2
        `,
        [teacherString, id_1c]
      );

      const status = {
        date: moment().format(),
        status: "created",
        user: userName,
      };

      await client.query(
        `
          UPDATE template_status
          SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb,
              id_profile_template = $2
          WHERE id_1c_template = $3
        `,
        [JSON.stringify([status]), idProfileTemplate, id_1c]
      );

      await client.query("COMMIT");
      return { result: "template created" };
    } catch (error) {
      await client.query("ROLLBACK");
      console.log(error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Rpd1cExchange;
