import type { RequestFingerprint } from "../types/express.ts";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import TokenService from "./Token.ts";
import { NotFound, Forbidden, Unauthorized } from "../utils/Errors.ts";
import RefreshSessionRepository from "../repositories/RefreshSession.ts";
import UserRepository from "../repositories/User.ts";
import { ACCESS_TOKEN_EXPIRATION, REFRESH_TOKEN_EXPIRATION } from "../../constants.ts";
import { pool } from "../../config/db.ts";

async function sessionPayload(refreshToken: unknown) {
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw new Unauthorized("Пользователь не авторизован в системе");
  }
  try {
    return await TokenService.verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new Unauthorized(error);
  }
}

class AuthService {
  static async signIn({ userName, password, fingerprint }: { userName: string; password: string; fingerprint: RequestFingerprint }) {
    const userData = await UserRepository.getUserData(userName);
    if (!userData) {
      throw new NotFound("Пользователь не найден");
    }

    const isPasswordValid = bcrypt.compareSync(password, userData.password);

    if (!isPasswordValid) {
      throw new Forbidden("Неверное имя или пароль");
    }

    if (!userData.is_active) {
      throw new Forbidden("Пользователь деактивирован");
    }

    const payload = { role: userData.role, id: userData.id, userName };
    const sid = randomUUID();

    const accessToken = await TokenService.generateAccessToken(payload);
    const refreshToken = await TokenService.generateRefreshToken({ ...payload, sid });

    await RefreshSessionRepository.deleteExpiredSessions();
    await RefreshSessionRepository.createRefreshSession({
      id: userData.id,
      sid,
      tokenHash: TokenService.hashRefreshToken(refreshToken),
      fingerprint,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRATION),
    });

    return {
      fullname: userData.fullname,
      role: userData.role,
      accessToken,
      refreshToken,
      accessTokenExpiration: ACCESS_TOKEN_EXPIRATION,
    };
  }

  static async logOut(refreshToken: unknown) {
    let payload;
    try {
      payload = await sessionPayload(refreshToken);
    } catch (error) {
      if (error instanceof Unauthorized) return;
      throw error;
    }
    await RefreshSessionRepository.deleteRefreshSession(payload.sid, TokenService.hashRefreshToken(refreshToken as string));
  }

  static async refresh({ fingerprint, currentRefreshToken }: { fingerprint: RequestFingerprint; currentRefreshToken: unknown }) {
    const payload = await sessionPayload(currentRefreshToken);
    const tokenHash = TokenService.hashRefreshToken(currentRefreshToken as string);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const refreshSession = await RefreshSessionRepository.getRefreshSession(tokenHash, client);
      if (!refreshSession || refreshSession.sid !== payload.sid || refreshSession.user_id !== payload.id
        || !fingerprint.hash || refreshSession.finger_print !== fingerprint.hash || !refreshSession.is_active) {
        throw new Unauthorized("Пользователь не авторизован в системе");
      }

      const { user_id: id, role, name: userName, fullname } = refreshSession;
      const actualPayload = { id, userName, role };
      const accessToken = await TokenService.generateAccessToken(actualPayload);
      let refreshToken: string | undefined;
      // Повтор предыдущего токена в окне не меняет ни cookie, ни срок окна.
      if (refreshSession.token_hash === tokenHash) {
        refreshToken = await TokenService.generateRefreshToken({ ...actualPayload, sid: payload.sid });
        await RefreshSessionRepository.rotateRefreshSession(
          payload.sid, TokenService.hashRefreshToken(refreshToken), new Date(Date.now() + REFRESH_TOKEN_EXPIRATION), client
        );
      }
      await client.query("COMMIT");
      return { role, fullname, accessToken, refreshToken, accessTokenExpiration: ACCESS_TOKEN_EXPIRATION };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export default AuthService;
