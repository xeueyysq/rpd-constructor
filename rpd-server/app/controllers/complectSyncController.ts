import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage, errorStatusCode } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import {
  preview1cSync,
  applySync,
  acknowledgeFieldChanges,
} from "../modules/complectSync.ts";

class ComplectSyncController {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async preview(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { complectId } = req.body;
      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }
      const result = await preview1cSync(complectId);
      res.json(result);
    } catch (error) {
      const status = errorStatusCode(error) || 500;
      res.status(status).json({ message: errorMessage(error) });
    }
  }

  async apply(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { complectId, selections } = req.body;
      if (!complectId) {
        return res
          .status(400)
          .json({ message: "Не указан идентификатор комплекта" });
      }
      const result = await applySync({
        complectId,
        selections,
        userId: req.user?.id,
      });
      res.json(result);
    } catch (error) {
      const status = errorStatusCode(error) || 500;
      res.status(status).json({ message: errorMessage(error) });
    }
  }

  async acknowledgeFieldChanges(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    try {
      const { profileTemplateId, changeIds } = req.body;
      if (!profileTemplateId) {
        return res.status(400).json({ message: "Не указан шаблон" });
      }
      const result = await acknowledgeFieldChanges(
        profileTemplateId,
        changeIds
      );
      res.json(result);
    } catch (error) {
      const status = errorStatusCode(error) || 500;
      res.status(status).json({ message: errorMessage(error) });
    }
  }
}

export default ComplectSyncController;
