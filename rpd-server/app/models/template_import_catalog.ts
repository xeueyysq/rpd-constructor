import type { Pool, PoolClient } from "pg";
import type { ImportSourceComplect } from "./template_import.ts";

type Database = Pool | PoolClient;
export type CatalogFilters = {
  search: string | null;
  faculty: string | null;
  educationLevel: string | null;
  direction: string | null;
  profile: string | null;
  educationForm: string | null;
  year: number | null;
  status: string | null;
  sourceMode: "other-complect" | "other-year";
  sameNameOnly: boolean;
  page: number;
  pageSize: number;
};
export type CatalogSummary = Omit<ImportSourceComplect, "templates"> & {
  templateCount: number; matchingTemplateCount: number;
};
export type CatalogFacets = {
  faculties: string[]; educationLevels: string[]; directions: string[];
  profiles: string[]; educationForms: string[]; years: number[];
};

// All template conditions precede grouping and pagination. The details query
// additionally restricts the complect before participant aggregation.
const candidates = `
  WITH eligible AS (
    SELECT c.id,c.uuid,c.faculty,c.direction,c.profile,c.year,c.education_form,c.education_level,
      p.id AS template_id,p.public_id,p.disciplins_name,p.semester,
      e.record_type,e.semester AS exchange_semester,
      COALESCE(ts.current_status,'created') AS status,
      NULLIF(regexp_replace(lower(btrim(p.disciplins_name)), '[[:space:]]+', ' ', 'g'),'') AS name_key
    FROM rpd_complects c
    JOIN rpd_profile_templates p ON p.id_rpd_complect=c.id
    LEFT JOIN template_status ts ON ts.id_profile_template=p.id
    LEFT JOIN rpd_1c_exchange e ON e.id=ts.id_1c_template
    WHERE c.id<>$1 AND (e.id IS NULL OR e.removed_at IS NULL)
      AND (NOT $15::boolean OR (e.id IS NOT NULL AND e.id_rpd_complect=c.id))
      AND ($2::int IS NULL OR EXISTS (
        SELECT 1 FROM teacher_templates own WHERE own.template_id=p.id AND own.user_id=$2))
      AND ($4::text<>'other-year' OR ($3::int IS NOT NULL AND c.year IS NOT NULL AND c.year<>$3::int))
  ), matched AS (
    SELECT * FROM eligible
    WHERE ($5::text IS NULL OR status=$5)
      AND ($6::text IS NULL OR faculty ILIKE $6 ESCAPE '\\'
        OR education_level ILIKE $6 ESCAPE '\\' OR direction ILIKE $6 ESCAPE '\\'
        OR profile ILIKE $6 ESCAPE '\\' OR education_form ILIKE $6 ESCAPE '\\'
        OR year::text ILIKE $6 ESCAPE '\\' OR disciplins_name ILIKE $6 ESCAPE '\\')
      AND (NOT $7::boolean OR name_key=NULLIF(regexp_replace(lower(btrim($8::text)),
        '[[:space:]]+', ' ', 'g'),''))
  ), counts AS (
    SELECT id,COUNT(*)::int AS template_count FROM eligible GROUP BY id
  ), summaries AS (
    SELECT m.id,m.uuid,m.faculty,m.direction,m.profile,m.year,m.education_form,m.education_level,
      counts.template_count AS "templateCount",COUNT(*)::int AS "matchingTemplateCount",
      BOOL_OR($8::text IS NOT NULL AND m.name_key=NULLIF(regexp_replace(lower(btrim($8::text)),
        '[[:space:]]+', ' ', 'g'),'')) AS preferred
    FROM matched m JOIN counts ON counts.id=m.id
    GROUP BY m.id,m.uuid,m.faculty,m.direction,m.profile,m.year,m.education_form,m.education_level,counts.template_count
  )
`;

const hierarchy = `($9::text IS NULL OR faculty=$9) AND ($10::text IS NULL OR education_level=$10)
  AND ($11::text IS NULL OR direction=$11) AND ($12::text IS NULL OR profile=$12)
  AND ($13::text IS NULL OR education_form=$13) AND ($14::int IS NULL OR year=$14)`;
const scopedHierarchy = hierarchy.replace(/\b(faculty|education_level|direction|profile|education_form|year)\b/g, "s.$1");

function facet(column: string, conditions: string, order = "value") {
  return `COALESCE((SELECT jsonb_agg(value ORDER BY ${order}) FROM
    (SELECT DISTINCT ${column} AS value FROM summaries WHERE ${conditions} AND ${column} IS NOT NULL) values),
    '[]'::jsonb)`;
}

export default class TemplateImportCatalogModel {
  static async targetYear(db: Database, complectId: number): Promise<number | null> {
    const { rows } = await db.query<{ year: number | null }>(
      "SELECT year FROM rpd_complects WHERE id=$1", [complectId]);
    return rows[0]?.year ?? null;
  }

  static params(targetComplectId: number, assignedTo: number | undefined, targetYear: number | null,
    targetName: string | null, bulk: boolean, filters: CatalogFilters): unknown[] {
    const search = filters.search == null ? null
      : `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
    return [targetComplectId, assignedTo ?? null, targetYear, filters.sourceMode, filters.status,
      search, filters.sameNameOnly, targetName, filters.faculty, filters.educationLevel,
      filters.direction, filters.profile, filters.educationForm, filters.year,
      bulk, filters.pageSize, (filters.page - 1) * filters.pageSize];
  }

  static async catalog(db: Database, params: unknown[]): Promise<{
    total: number; complects: CatalogSummary[]; facets: CatalogFacets;
  }> {
    const { rows } = await db.query<{
      total: number; complects: CatalogSummary[]; facets: CatalogFacets;
    }>(`${candidates}
      SELECT (SELECT COUNT(*)::int FROM summaries WHERE ${hierarchy}) AS total,
        COALESCE((SELECT jsonb_agg(to_jsonb(page) - 'preferred'
          ORDER BY CASE WHEN page.preferred THEN 0 ELSE 1 END,page.year DESC NULLS LAST,page.id)
          FROM (SELECT * FROM summaries WHERE ${hierarchy}
            ORDER BY CASE WHEN preferred THEN 0 ELSE 1 END,year DESC NULLS LAST,id
            LIMIT $16 OFFSET $17) page),'[]'::jsonb) AS complects,
        jsonb_build_object(
          'faculties',${facet("faculty", "TRUE")},
          'educationLevels',${facet("education_level", "($9::text IS NULL OR faculty=$9)")},
          'directions',${facet("direction", "($9::text IS NULL OR faculty=$9) AND ($10::text IS NULL OR education_level=$10)")},
          'profiles',${facet("profile", "($9::text IS NULL OR faculty=$9) AND ($10::text IS NULL OR education_level=$10) AND ($11::text IS NULL OR direction=$11)")},
          'educationForms',${facet("education_form", "($9::text IS NULL OR faculty=$9) AND ($10::text IS NULL OR education_level=$10) AND ($11::text IS NULL OR direction=$11) AND ($12::text IS NULL OR profile=$12)")},
          'years',${facet("year", "($9::text IS NULL OR faculty=$9) AND ($10::text IS NULL OR education_level=$10) AND ($11::text IS NULL OR direction=$11) AND ($12::text IS NULL OR profile=$12) AND ($13::text IS NULL OR education_form=$13)", "value DESC")}
        ) AS facets
    `, params);
    return rows[0];
  }

  static async details(db: Database, params: unknown[], sourceComplectId: number): Promise<ImportSourceComplect[]> {
    const scopedCandidates = candidates.replace("WHERE c.id<>$1", "WHERE c.id<>$1 AND c.id=$16");
    const { rows } = await db.query<ImportSourceComplect>(`${scopedCandidates}
      SELECT s.id,s.uuid,s.faculty,s.direction,s.profile,s.year,s.education_form,s.education_level,
        jsonb_agg(jsonb_build_object('id',m.template_id,'public_id',m.public_id,
          'disciplins_name',m.disciplins_name,'semester',
            CASE WHEN e.id IS NULL THEN m.semester ELSE m.exchange_semester END,
          'record_type',m.record_type,'status',m.status,
          'participants',COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',u.id,
            'fullname',COALESCE(NULLIF(CONCAT_WS(' ',NULLIF(BTRIM(u.fullname->>'surname'),''),
              NULLIF(BTRIM(u.fullname->>'name'),''),NULLIF(BTRIM(u.fullname->>'patronymic'),'')),''),u.name),
            'state',tt.state,'isActive',u.is_active) ORDER BY tt.id)
            FROM teacher_templates tt JOIN users u ON u.id=tt.user_id WHERE tt.template_id=m.template_id),'[]'::jsonb))
          ORDER BY m.template_id) AS templates
      FROM summaries s JOIN matched m ON m.id=s.id
      LEFT JOIN template_status ts ON ts.id_profile_template=m.template_id
      LEFT JOIN rpd_1c_exchange e ON e.id=ts.id_1c_template
      WHERE s.id=$16 AND ${scopedHierarchy}
      GROUP BY s.id,s.uuid,s.faculty,s.direction,s.profile,s.year,s.education_form,s.education_level
    `, [...params.slice(0, 15), sourceComplectId]);
    return rows;
  }
}
