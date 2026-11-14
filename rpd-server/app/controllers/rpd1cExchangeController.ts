import type { ParamsDictionary } from "express-serve-static-core";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import Rpd1cExchange from "../models/rpd_1c_exchange.ts";
import PlannedResults from "../services/PlannedResults.ts";
import { findRpd } from "../services/Complects.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import TemplateWorkflow from "../services/TemplateWorkflow.ts";
import { Unprocessable } from "../utils/Errors.ts";

class Rpd1cExchangeController {
  pool: Pool;
  model: Rpd1cExchange;
  constructor(pool: Pool) {
    this.pool = pool;
    this.model = new Rpd1cExchange(pool);
  }

  async setResultsData(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    res.json(await new PlannedResults(this.pool).replace(TemplateAccess.actor(req.user), req.body?.complectId, req.body?.data));
  }

  async getResultsData(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    res.json(await new PlannedResults(this.pool).get(TemplateAccess.actor(req.user), req.query.complectId));
  }

  async findRpd(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    const { complectId } = req.body;
    res.json(await findRpd(this.model.pool, complectId, TemplateAccess.actor(req.user)));
  }

  async createTemplate(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    const { id_1c, complectId, teacherIds } = req.body;
    if (typeof id_1c !== "number" || !Number.isSafeInteger(id_1c) || id_1c <= 0 || typeof complectId !== "number" || !Number.isSafeInteger(complectId) || complectId <= 0 || teacherIds !== undefined && (!Array.isArray(teacherIds) || teacherIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0))) throw new Unprocessable("Некорректные параметры создания");
    res.json(await new TemplateWorkflow(this.pool).createFrom1c(id_1c, complectId, TemplateAccess.actor(req.user), (teacherIds as number[] | undefined) ?? []));
  }
}

export default Rpd1cExchangeController;
