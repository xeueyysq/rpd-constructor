import type { Request, Response, NextFunction } from "express";
import validateRequest from "../utils/ValidateRequest.ts";
import * as Yup from "yup";

const signInSchema = Yup.object({
  body: Yup.object({
    userName: Yup.string()
      .required("Поле обязательно!")
      .max(25, "Максимальная длина - 25 символов"),
    password: Yup.string()
      .required("Поле обязательно!")
      .min(3, "Пароль слишком короткий - минимум 3 символа")
      .max(50, "Максимальная длина - 50 символов"),
  }),
});

const logoutSchema = Yup.object({
  cookies: Yup.object({
    refreshToken: Yup.string().required("Поле обязательно!"),
  }),
});

class AuthValidator {
  static async signIn(req: Request, res: Response, next: NextFunction) {
    return validateRequest(req, res, next, signInSchema);
  }

  static async logOut(req: Request, res: Response, next: NextFunction) {
    return validateRequest(req, res, next, logoutSchema);
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    return validateRequest(req, res, next);
  }
}

export default AuthValidator;
