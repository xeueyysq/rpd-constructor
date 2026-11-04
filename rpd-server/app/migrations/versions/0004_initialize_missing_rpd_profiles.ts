import type { MigrationClient } from "../runner.ts";

// Дозаполняем только отсутствующие РПД. Существующие связи, содержимое,
// статусы, история и участники не изменяются. Транзакцию открывает раннер.
export async function up(client: MigrationClient): Promise<void> {
  await client.query("LOCK TABLE rpd_complects, rpd_1c_exchange, template_status, rpd_profile_templates IN SHARE ROW EXCLUSIVE MODE");

  // У несвязанной legacy-РПД нет record_type. До любых вставок отказываемся
  // от неоднозначного сопоставления, даже если найден только один кандидат.
  const { rows: ambiguous } = await client.query<{ exchange_id: number; profile_id: number }>(`
    SELECT e.id AS exchange_id,p.id AS profile_id
    FROM rpd_1c_exchange e
    JOIN rpd_profile_templates p ON p.id_rpd_complect=e.id_rpd_complect
      AND LOWER(BTRIM(REGEXP_REPLACE(p.disciplins_name,'[[:space:]]+',' ','g')))=LOWER(BTRIM(REGEXP_REPLACE(e.discipline,'[[:space:]]+',' ','g')))
      AND p.semester IS NOT DISTINCT FROM e.semester
    WHERE e.removed_at IS NULL AND e.discipline ~ '[^[:space:]]'
      AND NOT EXISTS (SELECT 1 FROM template_status ts WHERE ts.id_1c_template=e.id AND ts.id_profile_template IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM template_status ts WHERE ts.id_profile_template=p.id AND ts.id_1c_template IS NOT NULL)
    ORDER BY e.id,p.id
  `);
  if (ambiguous.length) throw new Error(`Неоднозначные legacy-связи 1С/РПД: ${ambiguous.map((row) => `${row.exchange_id}/${row.profile_id}`).join(", ")}`);

  const { rows: missing } = await client.query<{ id: number; id_rpd_complect: number; discipline: string; department: string | null; place: string | null; semester: number | null; zet: number | null; study_load: unknown; control_load: unknown; status_id: number | null }>(`
    SELECT e.id,e.id_rpd_complect,e.discipline,e.department,e.place,e.semester,e.zet,e.study_load,e.control_load,ts.id AS status_id
    FROM rpd_1c_exchange e LEFT JOIN template_status ts ON ts.id_1c_template=e.id
    WHERE e.removed_at IS NULL AND e.discipline ~ '[^[:space:]]'
      AND ts.id_profile_template IS NULL
    ORDER BY e.id
  `);
  for (const row of missing) {
    const { rows: inserted } = await client.query<{ id: number }>(`
      INSERT INTO rpd_profile_templates(id_rpd_complect,disciplins_name,department,place,semester,competencies,zet,study_load,control_load)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb) RETURNING id
    `, [row.id_rpd_complect, row.discipline, row.department, row.place, row.semester, "{}", row.zet, JSON.stringify(row.study_load), JSON.stringify(row.control_load ?? {})]);
    const history = JSON.stringify([{ date: new Date().toISOString(), status: "created", user: "Система", action: "migration" }]);
    if (row.status_id !== null) await client.query("UPDATE template_status SET id_profile_template=$1,current_status='created',history=COALESCE(history,'[]'::jsonb)||$2::jsonb WHERE id=$3", [inserted[0].id, history, row.status_id]);
    else await client.query("INSERT INTO template_status(id_1c_template,id_profile_template,current_status,history) VALUES($1,$2,'created',$3::jsonb)", [row.id, inserted[0].id, history]);
  }
}
