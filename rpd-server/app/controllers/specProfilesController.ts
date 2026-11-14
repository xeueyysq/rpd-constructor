import { errorMessage } from "../utils/Errors.ts";
import { markFeedbackFailure } from "../middleware/feedbackDiagnostics.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import { loadReferenceTree } from "../modules/specProfilesMapping.ts";

class SpecProfilesController {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getProfiles(_req: Request, res: Response) {
    try {
      res.json({ tree: loadReferenceTree(), source: "local" });
    } catch (error) {
      markFeedbackFailure(res, error);
      console.error("Не удалось получить профили специальностей");
      res.status(500).json({ message: errorMessage(error) });
    }
  }
}

export default SpecProfilesController;
