import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage, errorStatusCode } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import RpdComplects from "../models/rpd_complects.ts";
import type { ComplectCriteria } from "../models/rpd_complects.ts";
import { USER_ROLE } from "../../constants.ts";

class RpdComplectsController {
  model: RpdComplects;
  constructor(pool: Pool) {
    this.model = new RpdComplects(pool);
  }

  async findRpdComplect(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { data } = req.body;
      const userId = req.user?.id;
      const record = await this.model.findRpdComplect(data as ComplectCriteria, userId);
      res.json(record);
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  }

  async createRpdComplect(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { data } = req.body;
      const userId = req.user?.id;
      const record = await this.model.createRpdComplect({ data: data as ComplectCriteria, userId });
      res.json(record);
    } catch (error) {
      const errorCode = errorStatusCode(error) || 500;
      res.status(errorCode).json({
        message: errorMessage(error),
        code: errorCode,
      });
    }
  }

  async getRpdComplects(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const currentUser = req.user!;
      let records = undefined;

      if (currentUser.role === USER_ROLE.ADMIN)
        records = await this.model.getAllRpdComplects();
      else records = await this.model.getRopComplects(currentUser.id);

      res.json(records);
    } catch (error) {
      res.status(500).json({ message: errorMessage(error) });
    }
  }

  async deleteRbdComplect(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const ids = req.body;
      const records = await this.model.deleteRpdComplect(ids);
      res.json(records);
    } catch (error) {
      const errorCode = errorStatusCode(error) || 500;
      res.status(errorCode).json({
        message: errorMessage(error),
        code: errorCode,
      });
    }
  }
}

export default RpdComplectsController;
