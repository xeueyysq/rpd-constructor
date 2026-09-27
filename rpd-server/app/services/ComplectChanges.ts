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
    WHERE id_1c_exchange=$1 AND acknowledged_at IS NULL ORDER BY applied_at,id`, [id]);
  return rows;
}

export async function acknowledgeExchangeChanges(db: Pool, actor: UserClaims, value: unknown) {
  const id = exchangeId(value);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows: exchanges } = await client.query<{ id_rpd_complect: number }>("SELECT id_rpd_complect FROM rpd_1c_exchange WHERE id=$1", [id]);
    if (!exchanges[0]) throw new NotFound("Строка 1С не найдена");
    const complectId = exchanges[0].id_rpd_complect;
    await client.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [complectId]);
    await TemplateAccess.assertComplect(client, actor, complectId);
    const updated = await client.query("UPDATE template_field_changes SET acknowledged_at=NOW() WHERE id_1c_exchange=$1 AND acknowledged_at IS NULL", [id]);
    const { rows } = await client.query<{ has_pending_changes: boolean }>(`
      UPDATE rpd_complects rc SET has_pending_changes=EXISTS (
        SELECT 1 FROM rpd_1c_exchange e JOIN template_field_changes c ON c.id_1c_exchange=e.id
        WHERE e.id_rpd_complect=rc.id AND c.acknowledged_at IS NULL
      ) WHERE rc.id=$1 RETURNING has_pending_changes`, [complectId]);
    await client.query("COMMIT");
    return { acknowledged: updated.rowCount ?? 0, hasPendingChanges: rows[0].has_pending_changes };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
