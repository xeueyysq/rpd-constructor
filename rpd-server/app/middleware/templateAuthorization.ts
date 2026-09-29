import type { Request, RequestHandler } from "express";
import type { Pool, PoolClient } from "pg";
import TemplateAccess from "../services/TemplateAccess.ts";
import { NotFound, Unprocessable } from "../utils/Errors.ts";

type Selector = (req: Request) => unknown;

export async function resolveTemplate(db: Pool | PoolClient, identifier: unknown): Promise<number> {
  if (typeof identifier !== "string" && typeof identifier !== "number" || String(identifier).trim() === "") throw new Unprocessable("Укажите шаблон");
  const { rows } = await db.query<{ id: number }>("SELECT id FROM rpd_profile_templates WHERE id::text=$1 OR public_id=$1 LIMIT 1", [String(identifier)]);
  if (!rows[0]) throw new NotFound("Шаблон не найден");
  return rows[0].id;
}

export async function resolveComplect(db: Pool | PoolClient, identifier: unknown): Promise<number> {
  if (typeof identifier !== "string" && typeof identifier !== "number" || String(identifier).trim() === "") throw new Unprocessable("Укажите комплект");
  const { rows } = await db.query<{ id: number }>("SELECT id FROM rpd_complects WHERE id::text=$1 OR uuid::text=$1 LIMIT 1", [String(identifier)]);
  if (!rows[0]) throw new NotFound("Комплект не найден");
  return rows[0].id;
}

export function templateAuthorization(db: Pool, selector: Selector, mode: "read" | "edit" | "manage"): RequestHandler {
  return async (req, _res, next) => {
    await TemplateAccess.assertTemplate(db, TemplateAccess.actor(req.user), await resolveTemplate(db, selector(req)), mode);
    next();
  };
}

export function complectAuthorization(db: Pool, selector: Selector): RequestHandler {
  return async (req, _res, next) => {
    await TemplateAccess.assertComplect(db, TemplateAccess.actor(req.user), await resolveComplect(db, selector(req)));
    next();
  };
}
