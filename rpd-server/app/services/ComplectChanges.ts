import type { Pool } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import TemplateAccess from "./TemplateAccess.ts";
import { NotFound, Unprocessable } from "../utils/Errors.ts";

function exchangeId(value: unknown): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Unprocessable("Некорректный exchangeId");
  return id;
}

export async function getExchangeChanges(db: Pool, actor: UserClaims, value: unknown) {
  const id = exchangeId(value);
  const { rows: exchanges } = await db.query<{ id_rpd_complect: number }>("SELECT id_rpd_complect FROM rpd_1c_exchange WHERE id=$1", [id]);
  if (!exchanges[0]) throw new NotFound("Строка 1С не найдена");
  await TemplateAccess.assertComplect(db, actor, exchanges[0].id_rpd_complect);
  const { rows } = await db.query<{ id: number; field_key: string; old_value: unknown; new_value: unknown; applied_at: Date; id_profile_template: number | null }>(`
    SELECT id,field_key,old_value,new_value,applied_at,id_profile_template FROM template_field_changes
    WHERE id_1c_exchange=$1 AND sync_log_id=(
      SELECT MAX(sync_log_id) FROM template_field_changes WHERE id_1c_exchange=$1
    ) ORDER BY applied_at,id`, [id]);
  return rows;
}
