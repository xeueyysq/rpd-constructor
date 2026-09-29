import type { NextFunction, Request, Response } from "express";
import { Forbidden } from "../utils/Errors.ts";

export default function requireRole(...roles: number[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new Forbidden());
    }
    next();
  };
}
