import type { PoolClient } from "pg";
import type { Rpd1cExchangeRow } from "../types/db.ts";
import { Conflict, NotFound } from "../utils/Errors.ts";

type CreationAuthor = { user: string; userId?: number };

// Вызывается внутри транзакции после блокировки комплекта. Связь через статус —
// единственный идентификатор РПД: одинаковые названия могут иметь разные record_type.
export async function initializeRpdFromExchange(client: PoolClient, exchangeId: number, complectId: number, author: CreationAuthor = { user: "Система" }): Promise<{ templateId: number; created: boolean } | null> {
  const { rows: exchange } = await client.query<Rpd1cExchangeRow>(`
    SELECT id,id_rpd_complect,discipline,department,place,semester,zet,study_load,control_load,removed_at
    FROM rpd_1c_exchange WHERE id=$1 AND id_rpd_complect=$2 FOR UPDATE
  `, [exchangeId, complectId]);
  const row = exchange[0];
  if (!row) throw new NotFound("Строка 1С не найдена в комплекте");
  if (row.removed_at || !row.discipline?.trim()) return null;

  const { rows: statuses } = await client.query<{ id: number; id_profile_template: number | null }>("SELECT id,id_profile_template FROM template_status WHERE id_1c_template=$1 FOR UPDATE", [exchangeId]);
  if (statuses[0]?.id_profile_template != null) return { templateId: statuses[0].id_profile_template, created: false };

  // У старой РПД без обменной связи нет record_type: не угадываем соответствие
  // и не создаём рядом с ней дубликат. Уже связанные РПД других строк допустимы.
  const { rows: unlinked } = await client.query<{ id: number }>(`
    SELECT p.id FROM rpd_profile_templates p
    WHERE p.id_rpd_complect=$1
      AND LOWER(BTRIM(REGEXP_REPLACE(p.disciplins_name,'[[:space:]]+',' ','g')))=LOWER(BTRIM(REGEXP_REPLACE($2::text,'[[:space:]]+',' ','g')))
      AND p.semester IS NOT DISTINCT FROM $3
      AND NOT EXISTS (SELECT 1 FROM template_status ts WHERE ts.id_profile_template=p.id AND ts.id_1c_template IS NOT NULL)
    ORDER BY p.id
  `, [complectId, row.discipline, row.semester]);
  if (unlinked.length) throw new Conflict(`Неоднозначная связь строки 1С ${exchangeId}: РПД без обменной связи ${unlinked.map((profile) => profile.id).join(", ")}`);

  const { rows: inserted } = await client.query<{ id: number }>(`
    INSERT INTO rpd_profile_templates(id_rpd_complect,disciplins_name,department,place,semester,competencies,zet,study_load,control_load)
    VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb) RETURNING id
  `, [complectId, row.discipline, row.department, row.place, row.semester, "{}", row.zet, JSON.stringify(row.study_load), JSON.stringify(row.control_load ?? {})]);
  const templateId = inserted[0].id;
  const history = JSON.stringify([{ date: new Date().toISOString(), status: "created", ...author, action: "create" }]);
  if (statuses[0]) await client.query("UPDATE template_status SET id_profile_template=$1,current_status='created',history=COALESCE(history,'[]'::jsonb)||$2::jsonb WHERE id=$3", [templateId, history, statuses[0].id]);
  else await client.query("INSERT INTO template_status(id_1c_template,id_profile_template,current_status,history) VALUES($1,$2,'created',$3::jsonb)", [exchangeId, templateId, history]);
  return { templateId, created: true };
}
