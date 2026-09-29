import type { NextFunction, Request, Response } from "express";
import * as Yup from "yup";
import validateRequest from "../utils/ValidateRequest.ts";

const schema = Yup.object({
  params: Yup.object({ id: Yup.string().required() }).required(),
  body: Yup.object({
    action: Yup.string().strict().required().oneOf(["assign", "unassign", "start", "finish", "reopen", "accept", "refine"]),
    userId: Yup.number().strict().integer().positive().optional(),
    comment: Yup.string().strict().optional(),
  }).strict().noUnknown(true).required(),
});

export default async function validateWorkflow(req: Request, res: Response, next: NextFunction) {
  return validateRequest(req, res, next, schema);
}
