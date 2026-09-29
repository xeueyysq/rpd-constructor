import type { ParamsDictionary } from "express-serve-static-core";
import type { Request, Response } from "express";
import AuthService from "../services/Auth.ts";
import { ErrorUtils } from "../utils/Errors.ts";
import { COOKIE_SETTINGS } from "../../constants.ts";

class AuthController {
  static async signIn(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    const { userName, password } = req.body as { userName: string; password: string };
    const fingerprint = req.fingerprint!;
    try {
      const { fullname, role, accessToken, refreshToken, accessTokenExpiration } =
        await AuthService.signIn({
          userName,
          password,
          fingerprint,
        });

      res.cookie("refreshToken", refreshToken, COOKIE_SETTINGS.REFRESH_TOKEN);

      return res.status(200).json({ fullname, role, accessToken, accessTokenExpiration });
    } catch (err) {
      return ErrorUtils.catchError(res, err);
    }
  }

  static async logOut(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    const refreshToken = req.cookies.refreshToken;
    try {
      await AuthService.logOut(refreshToken);

      res.clearCookie("refreshToken");

      return res.sendStatus(200);
    } catch (err) {
      return ErrorUtils.catchError(res, err);
    }
  }

  static async refresh(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
    const fingerprint = req.fingerprint!;
    const currentRefreshToken = req.cookies.refreshToken;

    try {
      const { role, fullname, accessToken, refreshToken, accessTokenExpiration } =
        await AuthService.refresh({
          currentRefreshToken,
          fingerprint,
        });

      res.cookie("refreshToken", refreshToken, COOKIE_SETTINGS.REFRESH_TOKEN);

      return res.status(200).json({ role, fullname, accessToken, accessTokenExpiration });
    } catch (err) {
      return ErrorUtils.catchError(res, err);
    }
  }
}

export default AuthController;
