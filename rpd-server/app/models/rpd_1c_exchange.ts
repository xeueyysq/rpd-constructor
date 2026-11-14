import type { Rpd1cExchangeRow } from "../types/db.ts";
import type { Pool, PoolClient } from "pg";
import { formatDisciplineName } from "../modules/disciplineNames.ts";
import type { PlannedResultEntry } from "../modules/plannedResults.ts";

type ResultRow = { competence_id: number; competence: string; indicator_id: number; indicator: string; discipline: string | null };
type RpdTemplateListRow = Pick<Rpd1cExchangeRow, "id" | "discipline" | "teachers" | "semester" | "removed_at"> & { id_profile_template: number | null; profile_template_public_id: string | null; status: string | null; status_history: unknown; sync_status: string; last_change_summary: string[]; sync_changed_at: Date | null; latest_count: number; has_profile_template: boolean };

class Rpd1cExchange {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async replaceResultsData(client: PoolClient, data: PlannedResultEntry[], complectId: number) {
    const { rows: setRows } = await client.query<{ id: number }>(`
      INSERT INTO planned_results_sets (complect_id) VALUES ($1)
      ON CONFLICT (complect_id) DO UPDATE SET complect_id = EXCLUDED.complect_id
      RETURNING id
    `, [complectId]);
    const setId = setRows[0]?.id;
    if (!setId) throw new Error("Не удалось создать набор планируемых результатов");
    await client.query("DELETE FROM planned_competencies WHERE set_id=$1", [setId]);

    const competencies = new Map<string, number>();
    for (const { competence, indicator, disciplines } of data) {
      let competenceId = competencies.get(competence);
      if (!competenceId) {
        const { rows } = await client.query<{ id: number }>(`
          INSERT INTO planned_competencies (set_id, competence) VALUES ($1, $2) RETURNING id
        `, [setId, competence]);
        competenceId = rows[0]?.id;
        if (!competenceId) throw new Error("Не удалось сохранить компетенцию при загрузке данных");
        competencies.set(competence, competenceId);
      }
      const { rows } = await client.query<{ id: number }>(`
        INSERT INTO planned_indicators (competence_id, indicator) VALUES ($1, $2) RETURNING id
      `, [competenceId, indicator]);
      const indicatorId = rows[0]?.id;
      if (!indicatorId) throw new Error("Не удалось сохранить индикатор при загрузке данных");
      for (const discipline of disciplines) {
        await client.query(`
          INSERT INTO planned_indicator_disciplines (indicator_id, discipline) VALUES ($1, $2)
        `, [indicatorId, discipline]);
      }
    }
    return { setId };
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

      const indicatorsMap = new Map<number, PlannedResultEntry>();
      const orderedResults: PlannedResultEntry[] = [];

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
          indicatorsMap.get(row.indicator_id)!.disciplines.push(formatDisciplineName(row.discipline));
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
        WITH latest_sync AS (
          SELECT tfc.id_1c_exchange, MAX(tfc.sync_log_id) AS sync_log_id
          FROM template_field_changes tfc
          JOIN rpd_1c_exchange exchange ON exchange.id = tfc.id_1c_exchange
          WHERE exchange.id_rpd_complect = $1
          GROUP BY tfc.id_1c_exchange
        ), latest_changes AS (
          SELECT tfc.id_1c_exchange,
            bool_or(tfc.field_key = '__new__') AS is_new,
            bool_or(tfc.field_key = 'removed') AS is_removed,
            array_agg(DISTINCT tfc.field_key) FILTER (
              WHERE tfc.field_key NOT IN ('__new__', 'removed', 'teachers')
            ) AS change_fields,
            COUNT(*)::int AS latest_count,
            MAX(tfc.applied_at) AS sync_changed_at
          FROM template_field_changes tfc
          JOIN latest_sync latest ON tfc.id_1c_exchange = latest.id_1c_exchange
            AND tfc.sync_log_id = latest.sync_log_id
          GROUP BY tfc.id_1c_exchange
        )
        SELECT r.id, r.discipline, r.teachers,
        r.semester, r.removed_at,
        ts.id_profile_template, rpt.public_id AS profile_template_public_id, ts.current_status AS status, ts.history AS status_history,
        CASE
          WHEN COALESCE(ch.is_removed, false) THEN 'removed'
          WHEN COALESCE(ch.is_new, false) THEN 'new'
          WHEN COALESCE(ch.latest_count, 0) > 0 THEN 'updated'
          ELSE 'unchanged'
        END AS sync_status,
        COALESCE(ch.change_fields, ARRAY[]::text[]) AS last_change_summary,
        ch.sync_changed_at,
        COALESCE(ch.latest_count, 0) AS latest_count,
        (ts.id_profile_template IS NOT NULL) AS has_profile_template
        FROM rpd_1c_exchange r
        LEFT JOIN template_status ts ON r.id = ts.id_1c_template
        LEFT JOIN rpd_profile_templates rpt ON rpt.id = ts.id_profile_template
        LEFT JOIN latest_changes ch ON ch.id_1c_exchange = r.id
        WHERE r.id_rpd_complect = $1
          AND NULLIF(TRIM(r.discipline), '') IS NOT NULL`,
          [complectId]
        );

      return queryResult.rows.map((row) => ({
        ...row,
        discipline: formatDisciplineName(row.discipline),
        syncStatus: row.sync_status,
        syncChangedAt: row.sync_changed_at ?? null,
        latestChanges: { count: row.latest_count, lastAppliedAt: row.sync_changed_at ?? null },
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
