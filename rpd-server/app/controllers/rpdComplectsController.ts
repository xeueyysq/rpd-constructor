import type { ParamsDictionary } from "express-serve-static-core";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import RpdComplects from "../models/rpd_complects.ts";
import type { ComplectCriteria } from "../models/rpd_complects.ts";
import { USER_ROLE } from "../../constants.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import { deleteComplects } from "../services/ComplectOwnership.ts";

class RpdComplectsController {
  model: RpdComplects;
  constructor(pool: Pool) {
    this.model = new RpdComplects(pool);
  }

  async findRpdComplect(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
      await TemplateAccess.assertActive(this.model.pool, TemplateAccess.actor(req.user));
      const { data } = req.body;
      const userId = req.user?.id;
      const record = await this.model.findRpdComplect(data as ComplectCriteria, req.user?.role === USER_ROLE.ADMIN ? undefined : userId);
      if (record !== "NotFound") await TemplateAccess.assertComplect(this.model.pool, TemplateAccess.actor(req.user), record.id);
      res.json(record);
  }

  async createRpdComplect(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
      await TemplateAccess.assertActive(this.model.pool, TemplateAccess.actor(req.user));
      const { data } = req.body;
      const record = await this.model.createRpdComplect({ data: data as ComplectCriteria, actor: TemplateAccess.actor(req.user) });
      res.json(record);
  }

  async getRpdComplects(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
      const currentUser = req.user!;
      await TemplateAccess.assertActive(this.model.pool, currentUser);
      const records = currentUser.role === USER_ROLE.ADMIN
        ? await this.model.getAllRpdComplects()
        : await this.model.getRopComplects(currentUser.id);

      res.json(records);
  }

  async deleteRbdComplect(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    res.json(await deleteComplects(this.model.pool, TemplateAccess.actor(req.user), req.body));
  }
}

export default RpdComplectsController;
