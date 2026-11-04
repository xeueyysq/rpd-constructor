import type { Request, Response } from "express";
import type { Pool } from "pg";
import type { ParamsDictionary } from "express-serve-static-core";
import TemplateAccess from "../services/TemplateAccess.ts";
import TemplateImport from "../services/TemplateImport.ts";
import TemplateContentControl from "../services/TemplateContentControl.ts";

type MutationRequest = Request<ParamsDictionary, unknown, Record<string, unknown>>;

export default class TemplateImportController {
  private readonly imports: TemplateImport;
  private readonly control: TemplateContentControl;
  constructor(pool: Pool) {
    this.imports = new TemplateImport(pool);
    this.control = new TemplateContentControl(pool);
  }

  sources = async (req: Request, res: Response) => {
    res.json(await this.imports.sources(TemplateAccess.actor(req.user), req.query.targetTemplateId, req.query.targetComplectId));
  };

  complect = async (req: MutationRequest, res: Response) => {
    const { sourceComplectId, targetComplectId, targetRevision } = req.body ?? {};
    res.json(await this.imports.complect(TemplateAccess.actor(req.user), sourceComplectId, targetComplectId, targetRevision));
  };

  clearControl = async (req: MutationRequest, res: Response) => {
    const { rowId, baseAt } = req.body ?? {};
    res.json(await this.control.clear(req.params.id, TemplateAccess.actor(req.user), rowId, baseAt));
  };
}
