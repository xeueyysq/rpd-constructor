import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import RpdChangeableValues from "../models/rpd_changeable_values.ts";

class RpdChangeableValuesController {
  model: RpdChangeableValues;
  constructor(pool: Pool) {
    this.model = new RpdChangeableValues(pool);
  }

  async getChangeableValues(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const value = await this.model.getChangeableValue(req.query.title);
      if (!value) {
        return res.status(404).json({ message: 'Record not found' });
      }
      res.json(value);
    } catch (err) {
      res.status(500).json({ message: errorMessage(err) });
    }
  }

  async updateChangeableValue(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const updatedValue = await this.model.updateChangeableValue(req.params.id, req.body.value);
      if (!updatedValue) {
        return res.status(404).json({ message: 'Value not found' });
      }
      res.json(updatedValue);
    } catch (err) {
      res.status(400).json({ message: errorMessage(err) });
    }
  }
}

export default RpdChangeableValuesController;