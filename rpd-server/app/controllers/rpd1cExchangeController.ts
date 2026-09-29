import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import Rpd1cExchange from "../models/rpd_1c_exchange.ts";
import RpdComplects from "../models/rpd_complects.ts";
import { findRpd } from "../services/Complects.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import TemplateWorkflow from "../services/TemplateWorkflow.ts";
import { Unprocessable } from "../utils/Errors.ts";

class Rpd1cExchangeController {
  pool: Pool;
  model: Rpd1cExchange;
  complectsModel: RpdComplects;
  constructor(pool: Pool) {
    this.pool = pool;
    this.model = new Rpd1cExchange(pool);
    this.complectsModel = new RpdComplects(pool);
  }

  async setResultsData(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { data, complectId } = req.body;

      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }

      const complectMeta = await this.complectsModel.findRpdComplectMeta(
        complectId
      );
      if (!complectMeta?.id) {
        return res
          .status(404)
          .json({ message: "Комплект не найден" });
      }

      const records = await this.model.setResultsData(
        Array.isArray(data) ? data : [],
        complectMeta.id
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: errorMessage(err) });
    }
  }

  async getResultsData(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const complectIdRaw = req.query?.complectId;
      if (!complectIdRaw) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }

      const complectMeta = await this.complectsModel.findRpdComplectMeta(
        complectIdRaw
      );
      if (!complectMeta?.id) {
        return res
          .status(404)
          .json({ message: "Комплект не найден" });
      }

      const records = await this.model.getResultsData(complectMeta.id);
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: errorMessage(err) });
    }
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
