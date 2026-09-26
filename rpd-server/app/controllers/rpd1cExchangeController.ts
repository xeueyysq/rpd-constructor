import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import Rpd1cExchange from "../models/rpd_1c_exchange.ts";
import RpdComplects from "../models/rpd_complects.ts";
import { findRpd } from "../services/Complects.ts";

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
    try {
      const { complectId } = req.body;
      const records = await findRpd(this.model.pool, complectId);
      res.json(records);
    } catch (err) {
      res.status(500).json({ message: errorMessage(err) });
    }
  }

  async createTemplate(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { id_1c, complectId, teachers, teacher, year, discipline, userName } = req.body;

      if (!complectId) {
        return res
          .status(400)
          .json({ result: "validation_error", message: "Не указан complectId" });
      }

      const complectMeta = await this.complectsModel.findRpdComplectMeta(
        complectId
      );
      if (!complectMeta?.id) {
        return res
          .status(404)
          .json({ message: "Комплект не найден" });
      }

      const record = await this.model.createTemplate(
        id_1c,
        complectMeta.id,
        Array.isArray(teachers) ? teachers : teacher,
        year,
        discipline,
        userName
      );
      res.json(record);
    } catch (err) {
      const validationErrors = [
        "Не указан id_1c",
        "Не указан complectId",
        "Не указана дисциплина",
        "Шаблон 1С не найден",
      ];
      const isValidation = validationErrors.some((msg) => errorMessage(err) === msg);
      if (isValidation) {
        return res.status(400).json({ result: "validation_error", message: errorMessage(err) });
      }
      res.status(500).json({ message: errorMessage(err) });
    }
  }
}

export default Rpd1cExchangeController;
