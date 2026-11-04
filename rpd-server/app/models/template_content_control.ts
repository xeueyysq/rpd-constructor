import type { PoolClient } from "pg";
import type { RpdProfileTemplateRow } from "../types/db.ts";
import { fieldEditsSet } from "../modules/fieldEdits.ts";

export async function saveClearedContent(client: PoolClient, id: number, content: Record<string, unknown>, actorId: number) {
  const { rows } = await client.query<Pick<RpdProfileTemplateRow, "content" | "field_edits">>(`
    UPDATE rpd_profile_templates SET content=$1::jsonb,${fieldEditsSet(3, 4)} WHERE id=$2 RETURNING content,field_edits
  `, [JSON.stringify(content), id, actorId, ["content"]]);
  return rows[0];
}
