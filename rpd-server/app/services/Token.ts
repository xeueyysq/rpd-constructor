import type { Request, Response, NextFunction } from "express";
import type { UserClaims } from "../types/express.ts";
import jwt from "jsonwebtoken";

import { Forbidden, Unauthorized } from "../utils/Errors.ts";

class TokenService {
  static async generateAccessToken(payload: UserClaims) {
    return await jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
      expiresIn: "30m",
    });
  }

  static async generateRefreshToken(payload: UserClaims) {
    return await jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
      expiresIn: "15d",
    });
  }

  static async verifyAccessToken(accessToken: string) {
    return await jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!) as UserClaims;
  }

  static async verifyRefreshToken(refreshToken: string) {
    return await jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!) as UserClaims;
  }

  static async checkAccess(req: Request, _: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")?.[1];

    if (!token) {
      return next(new Unauthorized());
    }

    try {
      req.user = await TokenService.verifyAccessToken(token);
      console.log(req.user);
    } catch (error) {
      console.log(error);
      return next(new Forbidden(error));
    }

    next();
  }
}

export default TokenService;
