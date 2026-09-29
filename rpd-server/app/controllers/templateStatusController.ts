import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import TemplateStatus from "../models/template_status.ts";

class TemplateStatusController {
  model: TemplateStatus;
    constructor(pool: Pool) {
        this.model = new TemplateStatus(pool);
    }   

    async getTemplateHistory (req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
        try {
            const { id } = req.body;
            const record = await this.model.getTemplateHistory(id);
            res.json(record);
        } catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    }
}

export default TemplateStatusController;