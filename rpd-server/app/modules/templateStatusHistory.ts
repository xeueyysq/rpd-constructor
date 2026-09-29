import type { Pool, PoolClient } from "pg";

export async function insertUnloadedStatus(db: Pool | PoolClient, exchangeId: number): Promise<void> {
  await db.query(`
    INSERT INTO template_status(id_1c_template,current_status,history)
    VALUES($1,'unloaded',$2::jsonb)
    ON CONFLICT(id_1c_template) WHERE id_1c_template IS NOT NULL DO NOTHING
  `, [exchangeId, JSON.stringify([{ date: new Date().toISOString(), status: "unloaded", user: "Система" }])]);
}
