import type { Request, Response } from "express";
import { Unprocessable } from "../utils/Errors.ts";
import TemplateAccess from "../services/TemplateAccess.ts";
import TemplateWorkflow from "../services/TemplateWorkflow.ts";
import type { WorkflowAction } from "../modules/templateWorkflow.ts";

const workflow = new TemplateWorkflow();

export default class TemplateWorkflowController {
  static async get(req: Request, res: Response) {
    res.json(await workflow.get(req.params.id, TemplateAccess.actor(req.user)));
  }

  static async post(req: Request, res: Response) {
    const body: unknown = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Unprocessable("Некорректное действие");
    const fields = body as Record<string, unknown>;
    const action = fields.action;
    if (typeof action !== "string" || !["assign", "unassign", "start", "finish", "reopen", "accept", "refine"].includes(action)) throw new Unprocessable("Некорректное действие");
    res.json(await workflow.apply(req.params.id, TemplateAccess.actor(req.user), action as WorkflowAction, typeof fields.userId === "number" ? fields.userId : undefined, typeof fields.comment === "string" ? fields.comment : undefined));
  }

  static async myTemplates(req: Request, res: Response) {
    res.json(await workflow.myTemplates(TemplateAccess.actor(req.user)));
  }

  static async assignableTeachers(req: Request, res: Response) {
    res.json(await workflow.assignableTeachers(TemplateAccess.actor(req.user)));
  }
}
