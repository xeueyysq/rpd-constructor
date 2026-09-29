import type { Pool } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import TemplateAccess from "./TemplateAccess.ts";
import { resolveComplect } from "../middleware/templateAuthorization.ts";
import { Forbidden, NotFound, Unprocessable } from "../utils/Errors.ts";
import { USER_ROLES } from "../models/constants.ts";

export async function replaceComplectOwner(db: Pool, actor: UserClaims, identifier: unknown, userId: unknown) {
  if (actor.role !== USER_ROLES.ADMIN) throw new Forbidden("Нет доступа к назначению владельца");
  if (!Number.isSafeInteger(userId) || Number(userId) <= 0) throw new Unprocessable("Укажите пользователя");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const id = await resolveComplect(client, identifier);
    const { rows: locked } = await client.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [id]);
    if (!locked[0]) throw new NotFound("Комплект не найден");
    await TemplateAccess.assertComplect(client, actor, id);
    const { rows: users } = await client.query<{ id: number }>("SELECT id FROM users WHERE id=$1 AND is_active AND role=$2 FOR SHARE", [userId, USER_ROLES.ROP]);
    if (!users[0]) throw new Unprocessable("Владелец должен быть активным РОП");
    await client.query("DELETE FROM user_complect WHERE complect_id=$1", [id]);
    await client.query("INSERT INTO user_complect(user_id,complect_id) VALUES($1,$2)", [userId, id]);
    await client.query("COMMIT");
    return { complectId: id, userId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function deleteComplects(db: Pool, actor: UserClaims, identifiers: unknown) {
  if (!Array.isArray(identifiers) || identifiers.length === 0) throw new Unprocessable("Укажите комплекты");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ids = [];
    for (const identifier of identifiers) ids.push(await resolveComplect(client, identifier));
    const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);
    for (const id of uniqueIds) {
      await client.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [id]);
      await TemplateAccess.assertComplect(client, actor, id);
    }
    const result = await client.query("DELETE FROM rpd_complects WHERE id=ANY($1::int[])", [uniqueIds]);
    await client.query("COMMIT");
    return { rowCount: result.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
