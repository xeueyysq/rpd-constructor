import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import { syncAndGetSpecProfiles } from "../modules/1cExchange.ts";

class SpecProfilesController {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getProfiles(_req: Request, res: Response) {
    try {
      const result = await syncAndGetSpecProfiles(this.pool);
      res.json(result);
    } catch (error) {
      console.error("spec-profiles error:", error);
      res.status(500).json({ message: errorMessage(error) });
    }
  }
}

export default SpecProfilesController;
