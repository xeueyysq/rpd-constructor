import type { Request, Response, NextFunction } from "express";
import type { UserClaims, RefreshClaims } from "../types/express.ts";
import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

import { Unauthorized } from "../utils/Errors.ts";
import { REFRESH_TOKEN_EXPIRATION } from "../../constants.ts";

class TokenService {
  static async generateAccessToken(payload: UserClaims) {
    return await jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
      expiresIn: "30m",
    });
  }

  static async generateRefreshToken(payload: UserClaims & { sid: string }) {
    return await jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
      expiresIn: REFRESH_TOKEN_EXPIRATION / 1000,
      jwtid: randomUUID(),
    });
  }

  static hashRefreshToken(refreshToken: string) {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  static async verifyAccessToken(accessToken: string) {
    return await jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!) as UserClaims;
  }

  static async verifyRefreshToken(refreshToken: string) {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!);
    if (typeof payload === "string" || typeof payload.id !== "number" || typeof payload.sid !== "string"
      || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(payload.sid)
      || typeof payload.jti !== "string" || !payload.jti || typeof payload.exp !== "number") {
      throw new jwt.JsonWebTokenError("Недействительный токен сессии");
    }
    return payload as RefreshClaims;
  }

  static async checkAccess(req: Request, _: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")?.[1];

    if (!token) {
      return next(new Unauthorized());
    }

    try {
      req.user = await TokenService.verifyAccessToken(token);
    } catch (error) {
      return next(new Unauthorized(error));
    }

    next();
  }
}

export default TokenService;
