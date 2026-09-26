import AuthService from "../services/Auth.ts";
import { ErrorUtils } from "../utils/Errors.ts";
import { COOKIE_SETTINGS } from "../../constants.ts";

class AuthController {
  static async signIn(req, res) {
    const { userName, password } = req.body;
    const { fingerprint } = req;
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

  static async signUp(req, res) {
    const { userName, password, role } = req.body;
    const { fingerprint } = req;

    try {
      const {
        fullname,
        role: createdRole,
        accessToken,
        refreshToken,
        accessTokenExpiration,
      } = await AuthService.signUp({
        userName,
        password,
        role,
        fingerprint,
      });

      res.cookie("refreshToken", refreshToken, COOKIE_SETTINGS.REFRESH_TOKEN);

      return res.status(200).json({
        fullname,
        role: createdRole,
        accessToken,
        accessTokenExpiration,
      });
    } catch (err) {
      return ErrorUtils.catchError(res, err);
    }
  }

  static async logOut(req, res) {
    const refreshToken = req.cookies.refreshToken;
    try {
      await AuthService.logOut(refreshToken);

      res.clearCookie("refreshToken");

      return res.sendStatus(200);
    } catch (err) {
      return ErrorUtils.catchError(res, err);
    }
  }

  static async refresh(req, res) {
    const { fingerprint } = req;
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
