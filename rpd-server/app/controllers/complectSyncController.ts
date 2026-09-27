import type { ParamsDictionary } from "express-serve-static-core";
import { Unprocessable } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import {
  preview1cSync,
  applySync,
} from "../modules/complectSync.ts";
import { acknowledgeExchangeChanges, getExchangeChanges } from "../services/ComplectChanges.ts";
import TemplateAccess from "../services/TemplateAccess.ts";

class ComplectSyncController {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async preview(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
      const { complectId } = req.body;
      if (!complectId) throw new Unprocessable("Не указан идентификатор комплекта");
      const result = await preview1cSync(complectId);
      res.json(result);
  }

  async apply(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
      const { complectId, selections } = req.body;
      if (!complectId) throw new Unprocessable("Не указан идентификатор комплекта");
      const result = await applySync({
        complectId,
        selections,
        actor: TemplateAccess.actor(req.user),
      });
      res.json(result);
  }

  async acknowledgeFieldChanges(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    res.json(await acknowledgeExchangeChanges(this.pool, TemplateAccess.actor(req.user), req.body.exchangeId));
  }

  async changes(req: Request, res: Response) {
    res.json(await getExchangeChanges(this.pool, TemplateAccess.actor(req.user), req.query.exchangeId));
  }
}

export default ComplectSyncController;
