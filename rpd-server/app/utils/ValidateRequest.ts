import type { Request, Response, NextFunction } from "express";
import type { Schema } from "yup";
import { ErrorUtils, Unprocessable } from "./Errors.ts";

export default async (req: Request, res: Response, next: NextFunction, schema?: Schema) => {
  try {
    if (schema) {
      await schema.validate(req);
    }

    return next();
  } catch (error) {
    const { path, errors } = error && typeof error === "object" ? error as { path?: string; errors?: string[] } : {};
    return ErrorUtils.catchError(
      res,
      new Unprocessable(JSON.stringify({ path, errors }))
    );
  }
};
