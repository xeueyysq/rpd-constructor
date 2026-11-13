import type { Pool, PoolClient } from "pg";
import type { RpdComplectRow, RpdProfileTemplateRow } from "../types/db.ts";
import type { ParticipationState, TemplateStatus } from "../modules/templateWorkflow.ts";
import { TEMPLATE_IMPORT_FIELDS, type TemplateImportField } from "../modules/templateImport.ts";
import { fieldEditsSet } from "../modules/fieldEdits.ts";
import type { WordValues } from "../modules/wordImport/wordAdapter.ts";

type Database = Pool | PoolClient;
export type ImportTemplate = RpdProfileTemplateRow & { current_status: TemplateStatus | "closed" | null; exchange_id: number | null; removed_at: Date | null };
export type ImportExchange = { exchange_id: number; discipline: string | null; semester: number | null; record_type: string | null; template_id: number | null; current_status: TemplateStatus | "closed" | null };
export type ImportParticipant = { userId: number; fullname: string; state: ParticipationState; isActive: boolean };
export type ImportSourceTemplate = {
  id: number; public_id: string; disciplins_name: string | null; semester: number | null;
  record_type: string | null; status: TemplateStatus; participants: ImportParticipant[];
};
export type ImportSourceComplect = Pick<RpdComplectRow, "id" | "uuid" | "faculty" | "direction" | "profile" | "year" | "education_form" | "education_level"> & { templates: ImportSourceTemplate[] };

export default class TemplateImportModel {
  static async template(db: Database, id: number): Promise<ImportTemplate | undefined> {
    const { rows } = await db.query<ImportTemplate>(`
      SELECT p.*,ts.current_status,e.id AS exchange_id,e.removed_at
      FROM rpd_profile_templates p LEFT JOIN template_status ts ON ts.id_profile_template=p.id
      LEFT JOIN rpd_1c_exchange e ON e.id=ts.id_1c_template WHERE p.id=$1
    `, [id]);
    return rows[0];
  }

  static async lock(db: PoolClient, complectIds: number[], actorId: number) {
    await db.query("SELECT id FROM rpd_complects WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE", [complectIds]);
    await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [actorId]);
    await db.query("SELECT id FROM rpd_1c_exchange WHERE id_rpd_complect=ANY($1::int[]) ORDER BY id FOR UPDATE", [complectIds]);
    await db.query(`SELECT ts.id FROM template_status ts WHERE ts.id_profile_template IN
      (SELECT id FROM rpd_profile_templates WHERE id_rpd_complect=ANY($1::int[])) ORDER BY ts.id FOR UPDATE`, [complectIds]);
    await db.query("SELECT id FROM rpd_profile_templates WHERE id_rpd_complect=ANY($1::int[]) ORDER BY id FOR UPDATE", [complectIds]);
  }

  static async revisionState(db: Database, complectId: number, templateId?: number) {
    const { rows } = await db.query<{ state: unknown }>(`
      SELECT jsonb_build_object('complect',to_jsonb(c),
        'exchange',(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM rpd_1c_exchange e WHERE e.id_rpd_complect=c.id),
        'templates',(SELECT jsonb_agg(jsonb_build_object('id',p.id,'edits',p.field_edits,
          'status',to_jsonb(ts),'participants',(SELECT jsonb_agg(to_jsonb(tt) ORDER BY tt.user_id)
            FROM teacher_templates tt WHERE tt.template_id=p.id)) ORDER BY p.id)
          FROM rpd_profile_templates p LEFT JOIN template_status ts ON ts.id_profile_template=p.id
          WHERE p.id_rpd_complect=c.id AND ($2::int IS NULL OR p.id=$2))) AS state
      FROM rpd_complects c WHERE c.id=$1
    `, [complectId, templateId ?? null]);
    return rows[0]?.state;
  }

  static async sources(db: Database, excludedComplectId: number, assignedTo?: number): Promise<ImportSourceComplect[]> {
    const { rows } = await db.query<ImportSourceComplect>(`
      SELECT c.id,c.uuid,c.faculty,c.direction,c.profile,c.year,c.education_form,c.education_level,
        COALESCE(jsonb_agg(jsonb_build_object('id',p.id,'public_id',p.public_id,
          'disciplins_name',p.disciplins_name,'semester',CASE WHEN e.id IS NULL THEN p.semester ELSE e.semester END,
          'record_type',e.record_type,'status',COALESCE(ts.current_status,'created'),
          'participants',COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',u.id,
            'fullname',COALESCE(NULLIF(CONCAT_WS(' ',NULLIF(BTRIM(u.fullname->>'surname'),''),
              NULLIF(BTRIM(u.fullname->>'name'),''),NULLIF(BTRIM(u.fullname->>'patronymic'),'')),''),u.name),
            'state',tt.state,'isActive',u.is_active) ORDER BY tt.id)
            FROM teacher_templates tt JOIN users u ON u.id=tt.user_id WHERE tt.template_id=p.id),'[]'::jsonb))
          ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL),'[]'::jsonb) AS templates
      FROM rpd_complects c LEFT JOIN rpd_profile_templates p ON p.id_rpd_complect=c.id
      LEFT JOIN template_status ts ON ts.id_profile_template=p.id
      LEFT JOIN rpd_1c_exchange e ON e.id=ts.id_1c_template
      WHERE c.id<>$1 AND (e.id IS NULL OR e.removed_at IS NULL)
        AND ($2::int IS NULL OR EXISTS (SELECT 1 FROM teacher_templates own
          WHERE own.template_id=p.id AND own.user_id=$2))
      GROUP BY c.id ORDER BY c.year DESC,c.id
    `, [excludedComplectId, assignedTo ?? null]);
    return rows;
  }

  static async isAssigned(db: Database, templateId: number, actorId: number): Promise<boolean> {
    const { rows } = await db.query<{ assigned: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM teacher_templates WHERE template_id=$1 AND user_id=$2) AS assigned",
      [templateId, actorId],
    );
    return Boolean(rows[0]?.assigned);
  }

  static async fields(db: Database): Promise<TemplateImportField[]> {
    const { rows } = await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='rpd_profile_templates'");
    const columns = new Set(rows.map((row) => row.column_name));
    return TEMPLATE_IMPORT_FIELDS.filter((field) => columns.has(field));
  }

  static async preview(db: Database, ids: number[], field: TemplateImportField) {
    const { rows } = await db.query<Record<string, unknown>>(`SELECT ${field},id,public_id FROM rpd_profile_templates WHERE id=ANY($1::int[])`, [ids]);
    return rows;
  }

  static async replace(db: PoolClient, sourceId: number, targetId: number, fields: TemplateImportField[], actorId: number) {
    // SQL-to-SQL замена сохраняет JSONB, text[] и NULL без преобразования значений.
    const { rows } = await db.query<RpdProfileTemplateRow>(`
      UPDATE rpd_profile_templates p SET ${fields.map((field) => `${field}=s.${field}`).join(",")},
        ${fieldEditsSet(3, 4, "p")} FROM rpd_profile_templates s WHERE s.id=$1 AND p.id=$2 RETURNING p.*
    `, [sourceId, targetId, actorId, fields]);
    return rows[0];
  }

  static async setValues(db: PoolClient, targetId: number, fields: TemplateImportField[], values: WordValues, actorId: number) {
    const assignments = fields.map((field, index) => `${field}=$${index + 1}${field === "content" ? "::jsonb" : ""}`).join(",");
    const params = fields.map((field) => field === "content" ? JSON.stringify(values[field]) : values[field]);
    const { rows } = await db.query<RpdProfileTemplateRow>(`
      UPDATE rpd_profile_templates p SET ${assignments},${fieldEditsSet(fields.length + 2, fields.length + 3, "p")}
      WHERE p.id=$${fields.length + 1} RETURNING p.*
    `, [...params, targetId, actorId, fields]);
    return rows[0];
  }

  static async exchanges(db: Database, complectId: number): Promise<ImportExchange[]> {
    const { rows } = await db.query<ImportExchange>(`
      SELECT e.id AS exchange_id,e.discipline,e.semester,e.record_type,p.id AS template_id,ts.current_status
      FROM rpd_1c_exchange e LEFT JOIN template_status ts ON ts.id_1c_template=e.id
      LEFT JOIN rpd_profile_templates p ON p.id=ts.id_profile_template AND p.id_rpd_complect=e.id_rpd_complect
      WHERE e.id_rpd_complect=$1 AND e.removed_at IS NULL ORDER BY e.id
    `, [complectId]);
    return rows;
  }
}
