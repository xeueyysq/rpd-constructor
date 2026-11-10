import type { Pool } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import TemplateAccess from "./TemplateAccess.ts";
import { resolveComplect } from "../middleware/templateAuthorization.ts";
import { Conflict, Forbidden, NotFound, Unprocessable } from "../utils/Errors.ts";
import { USER_ROLES } from "../models/constants.ts";
import { assertActiveAdmin } from "./AdminAccess.ts";

function parseUserIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647)
    || new Set(value).size !== value.length) throw new Unprocessable("Укажите уникальные положительные userIds и baseUserIds");
  return [...value].sort((a, b) => a - b);
}

async function setOwners(db: Pool, actor: UserClaims, identifier: unknown, nextIds: number[], baseIds?: number[]) {
  if (actor.role !== USER_ROLES.ADMIN) throw new Forbidden("Нет доступа к назначению РОП");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const id = await resolveComplect(client, identifier);
    const { rows: locked } = await client.query("SELECT id FROM rpd_complects WHERE id=$1 FOR UPDATE", [id]);
    if (!locked[0]) throw new NotFound("Комплект не найден");
    await assertActiveAdmin(client, actor);
    const { rows: current } = await client.query<{ user_id: number }>("SELECT user_id FROM user_complect WHERE complect_id=$1 ORDER BY user_id", [id]);
    const currentIds = current.map((owner) => owner.user_id);
    if (baseIds && JSON.stringify(baseIds) !== JSON.stringify(currentIds)) {
      throw new Conflict({ message: "Состав РОП уже изменён. Обновите список и повторите выбор", userIds: currentIds });
    }
    const { rows: users } = await client.query<{ id: number }>("SELECT id FROM users WHERE id=ANY($1::int[]) AND is_active AND role=$2 ORDER BY id FOR SHARE", [nextIds, USER_ROLES.ROP]);
    if (users.length !== nextIds.length) throw new Unprocessable("Все назначаемые пользователи должны быть активными РОП");
    await client.query("DELETE FROM user_complect WHERE complect_id=$1 AND NOT (user_id=ANY($2::int[]))", [id, nextIds]);
    for (const userId of nextIds) {
      await client.query("INSERT INTO user_complect(user_id,complect_id) VALUES($1,$2) ON CONFLICT(user_id,complect_id) DO NOTHING", [userId, id]);
    }
    await client.query("COMMIT");
    return { complectId: id, userIds: nextIds };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function replaceComplectOwners(db: Pool, actor: UserClaims, identifier: unknown, userIds: unknown, baseUserIds: unknown) {
  return setOwners(db, actor, identifier, parseUserIds(userIds), parseUserIds(baseUserIds));
}

// Совместимость: scalar endpoint по-прежнему полностью заменяет состав одним РОП.
export async function replaceComplectOwner(db: Pool, actor: UserClaims, identifier: unknown, userId: unknown) {
  const result = await setOwners(db, actor, identifier, parseUserIds([userId]));
  return { complectId: result.complectId, userId: result.userIds[0] };
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
