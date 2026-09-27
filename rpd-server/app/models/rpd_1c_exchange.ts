import type { Rpd1cExchangeRow } from "../types/db.ts";
import type { Pool } from "pg";

type ResultRow = { competence_id: number; competence: string; indicator_id: number; indicator: string; discipline: string | null };
type ResultEntry = { competence: string; indicator: string; disciplines: string[] };
type RpdTemplateListRow = Pick<Rpd1cExchangeRow, "id" | "discipline" | "teachers" | "semester" | "removed_at"> & { id_profile_template: number | null; profile_template_public_id: string | null; status: string | null; sync_status: string; last_change_summary: string[]; sync_changed_at: Date | null; has_profile_template: boolean };

class Rpd1cExchange {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async setResultsData(data: unknown, complectId: unknown) {
    if (!complectId) {
      throw new Error("Не указан идентификатор комплекта");
    }

    if (!Array.isArray(data)) {
      throw new Error("Некорректный формат данных компетенций");
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const { rows: setRows } = await client.query<{ id: number }>(
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

      const competenciesMap = new Map<string, { id?: number; indicators: Map<string, { id?: number }> }>();

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
          const { rows: competenceRows } = await client.query<{ id: number }>(
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
          const { rows: indicatorRows } = await client.query<{ id: number }>(
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
          throw new Error("Не удалось сохранить индикатор при загрузке данных");
        }

        const uniqueDisciplines = [
          ...new Set(
            disciplines
              .filter((discipline: unknown): discipline is string => typeof discipline === "string")
              .map((discipline: string) => discipline.trim())
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

  async getResultsData(complectId: unknown) {
    if (!complectId) {
      throw new Error("Не указан идентификатор комплекта");
    }

    try {
      const { rows } = await this.pool.query<ResultRow>(
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

      const indicatorsMap = new Map<number, ResultEntry>();
      const orderedResults: ResultEntry[] = [];

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
          indicatorsMap.get(row.indicator_id)!.disciplines.push(row.discipline);
        }
      }

      return orderedResults;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async findRpd(complectId: unknown) {
    try {
      const queryResult = await this.pool.query<RpdTemplateListRow>(
          `
        SELECT r.id, r.discipline, r.teachers,
        r.semester, r.removed_at,
        ts.id_profile_template, rpt.public_id AS profile_template_public_id, ts.current_status AS status,
        CASE
          WHEN r.removed_at IS NOT NULL THEN 'removed'
          WHEN COALESCE(ch.is_new, false) THEN 'new'
          WHEN COALESCE(array_length(ch.change_fields, 1), 0) > 0 THEN 'updated'
          ELSE 'unchanged'
        END AS sync_status,
        COALESCE(ch.change_fields, ARRAY[]::text[]) AS last_change_summary,
        ch.sync_changed_at,
        (ts.id_profile_template IS NOT NULL) AS has_profile_template
        FROM rpd_1c_exchange r
        LEFT JOIN template_status ts ON r.id = ts.id_1c_template
        LEFT JOIN rpd_profile_templates rpt ON rpt.id = ts.id_profile_template
        LEFT JOIN LATERAL (
          SELECT
            bool_or(tfc.field_key = '__new__') AS is_new,
            array_agg(DISTINCT tfc.field_key) FILTER (
              WHERE tfc.field_key NOT IN ('__new__', 'removed', 'teachers')
            ) AS change_fields,
            MAX(tfc.applied_at) AS sync_changed_at
          FROM template_field_changes tfc
          WHERE tfc.id_1c_exchange = r.id
            AND tfc.acknowledged_at IS NULL
        ) ch ON true
        WHERE r.id_rpd_complect = $1
          AND NULLIF(TRIM(r.discipline), '') IS NOT NULL`,
          [complectId]
        );

      return queryResult.rows.map((row) => ({
        ...row,
        syncStatus: row.sync_status,
        syncChangedAt: row.sync_changed_at ?? row.removed_at ?? null,
        lastChangeSummary: row.last_change_summary ?? [],
        hasProfileTemplate: row.has_profile_template,
      }));
    } catch (err) {
      console.error(err);
      throw new Error("Ошибка в models/rpd_1c_exchange/findRpd", { cause: err });
    }
  }


}

export default Rpd1cExchange;
