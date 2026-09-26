import type { RequestFingerprint } from "../types/express.ts";
import bcrypt from "bcryptjs";
import TokenService from "./Token.ts";
import { NotFound, Forbidden, Unauthorized } from "../utils/Errors.ts";
import RefreshSessionRepository from "../repositories/RefreshSession.ts";
import UserRepository from "../repositories/User.ts";
import { ACCESS_TOKEN_EXPIRATION } from "../../constants.ts";

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

    const accessToken = await TokenService.generateAccessToken(payload);
    const refreshToken = await TokenService.generateRefreshToken(payload);

    await RefreshSessionRepository.createRefreshSession({
      id: userData.id,
      refreshToken,
      fingerprint,
    });

    return {
      fullname: userData.fullname,
      role: userData.role,
      accessToken,
      refreshToken,
      accessTokenExpiration: ACCESS_TOKEN_EXPIRATION,
    };
  }

  static async logOut(refreshToken: string) {
    await RefreshSessionRepository.deleteRefreshSession(refreshToken);
  }

  static async refresh({ fingerprint, currentRefreshToken }: { fingerprint: RequestFingerprint; currentRefreshToken: string }) {
    if (!currentRefreshToken) {
      throw new Unauthorized("Пользователь не авторизован в системе");
    }

    const refreshSession = await RefreshSessionRepository.getRefreshSession(
      currentRefreshToken
    );

    if (!refreshSession) {
      throw new Unauthorized("Пользователь не авторизован в системе");
    }

    if (refreshSession.finger_print !== fingerprint.hash) {
      console.log("Попытка несанкционированного обновления токенов");
      throw new Forbidden();
    }

    await RefreshSessionRepository.deleteRefreshSession(currentRefreshToken);

    let payload;
    try {
      payload = await TokenService.verifyRefreshToken(currentRefreshToken);
    } catch (error) {
      throw new Forbidden(error);
    }

    const user = await UserRepository.getUserById(payload.id);
    if (!user || !user.is_active) {
      throw new Unauthorized("Пользователь не авторизован в системе");
    }
    const { id, role, name: userName, fullname } = user;

    const actualPayload = { id, userName, role };

    const accessToken = await TokenService.generateAccessToken(actualPayload);
    const refreshToken = await TokenService.generateRefreshToken(actualPayload);

    await RefreshSessionRepository.createRefreshSession({
      id,
      refreshToken,
      fingerprint,
    });

    return {
      role,
      fullname,
      accessToken,
      refreshToken,
      accessTokenExpiration: ACCESS_TOKEN_EXPIRATION,
    };
  }
}

export default AuthService;
