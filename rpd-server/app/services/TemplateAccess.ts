import type { Pool, PoolClient } from "pg";
import type { UserClaims } from "../types/express.d.ts";
import { Forbidden, NotFound, Unauthorized } from "../utils/Errors.ts";
import { USER_ROLES } from "../models/constants.ts";

type Database = Pick<Pool | PoolClient, "query">;

export default class TemplateAccess {
  static actor(actor: UserClaims | undefined): UserClaims {
    if (!actor) throw new Unauthorized("Требуется авторизация");
    return actor;
  }

  static async assertComplect(db: Database, actor: UserClaims, complectId: number, mode: "manage" = "manage"): Promise<void> {
    void mode;
    const { rows } = await db.query<{ exists: boolean; owner: boolean; active: boolean }>(`
      SELECT EXISTS(SELECT 1 FROM rpd_complects WHERE id=$1) AS exists,
        EXISTS(SELECT 1 FROM user_complect WHERE complect_id=$1 AND user_id=$2) AS owner,
        EXISTS(SELECT 1 FROM users WHERE id=$2 AND is_active) AS active
    `, [complectId, actor.id]);
    if (!rows[0]?.exists) throw new NotFound("Комплект не найден");
    if (!rows[0].active || actor.role !== USER_ROLES.ADMIN && !(actor.role === USER_ROLES.ROP && rows[0].owner)) throw new Forbidden("Нет доступа к комплекту");
  }

  static async assertTemplate(db: Database, actor: UserClaims, templateId: number, mode: "read" | "edit" | "manage"): Promise<void> {
    const { rows } = await db.query<{ exists: boolean; owner: boolean; participant: boolean; active: boolean }>(`
      SELECT EXISTS(SELECT 1 FROM rpd_profile_templates WHERE id=$1) AS exists,
        EXISTS(SELECT 1 FROM rpd_profile_templates rpt JOIN user_complect uc ON uc.complect_id=rpt.id_rpd_complect WHERE rpt.id=$1 AND uc.user_id=$2) AS owner,
        EXISTS(SELECT 1 FROM teacher_templates tt JOIN users u ON u.id=tt.user_id WHERE tt.template_id=$1 AND tt.user_id=$2 AND u.is_active) AS participant,
        EXISTS(SELECT 1 FROM users WHERE id=$2 AND is_active) AS active
    `, [templateId, actor.id]);
    if (!rows[0]?.exists) throw new NotFound("Шаблон не найден");
    if (!rows[0].active) throw new Forbidden("Пользователь неактивен");
    const manager = actor.role === USER_ROLES.ADMIN || actor.role === USER_ROLES.ROP && rows[0].owner;
    if (!manager && (mode === "manage" || !rows[0].participant)) throw new Forbidden("Нет доступа к шаблону");
  }

  static async canManageTemplate(db: Database, actor: UserClaims, templateId: number): Promise<boolean> {
    const { rows } = await db.query<{ owner: boolean; active: boolean }>(`
      SELECT EXISTS(SELECT 1 FROM rpd_profile_templates rpt JOIN user_complect uc ON uc.complect_id=rpt.id_rpd_complect WHERE rpt.id=$1 AND uc.user_id=$2) AS owner,
        EXISTS(SELECT 1 FROM users WHERE id=$2 AND is_active) AS active
    `, [templateId, actor.id]);
    return Boolean(rows[0]?.active && (actor.role === USER_ROLES.ADMIN || actor.role === USER_ROLES.ROP && rows[0].owner));
  }
}
