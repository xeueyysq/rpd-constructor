import type { Pool, PoolClient } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import { USER_ROLES } from "../models/constants.ts";
import { Forbidden } from "../utils/Errors.ts";

export async function assertActiveAdmin(db: Pick<Pool | PoolClient, "query">, actor: UserClaims) {
  if (actor.role !== USER_ROLES.ADMIN) throw new Forbidden("Действие доступно только администратору");
  const { rows } = await db.query<{ role: number; is_active: boolean }>(
    "SELECT id,role,is_active FROM users WHERE id=$1 FOR SHARE", [actor.id],
  );
  if (!rows[0]?.is_active || rows[0].role !== USER_ROLES.ADMIN) {
    throw new Forbidden("Действие доступно только активному администратору");
  }
}
