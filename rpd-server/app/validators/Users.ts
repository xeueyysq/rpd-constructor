import type { NextFunction, Request, Response } from "express";
import * as Yup from "yup";
import { ASSIGNABLE_TEACHER_ROLES } from "../models/constants.ts";
import validateRequest from "../utils/ValidateRequest.ts";

const text = (message: string, allowUndefined = false) => Yup.string()
  .test("string", message, (_value, context) =>
    (allowUndefined && context.originalValue === undefined) || typeof context.originalValue === "string"
  );

const fullnameSchema = Yup.object({
  surname: text("Фамилия должна быть строкой").trim().required("Фамилия обязательна"),
  name: text("Имя должно быть строкой").trim().required("Имя обязательно"),
  patronymic: text("Отчество должно быть строкой").defined("Отчество обязательно"),
}).required();

const userFields = {
  name: text("Логин должен быть строкой").trim().required("Логин обязателен").max(25, "Логин слишком длинный"),
  role: Yup.number().strict().required("Роль обязательна").oneOf(ASSIGNABLE_TEACHER_ROLES, "Недопустимая роль"),
  fullname: fullnameSchema,
};

const passwordSchema = text("Пароль должен быть строкой").min(3, "Пароль слишком короткий")
  .max(50, "Пароль слишком длинный");

const createSchema = Yup.object({
  body: Yup.object({ ...userFields, password: passwordSchema.required("Пароль обязателен") }).required(),
});

const updateSchema = Yup.object({
  params: Yup.object({
    id: Yup.string().required().matches(/^[1-9]\d*$/, "Некорректный id")
      .test("safe-id", "Некорректный id", (value) => Number.isSafeInteger(Number(value))),
  }).required(),
  body: Yup.object({
    ...userFields,
    password: text("Пароль должен быть строкой", true).max(50, "Пароль слишком длинный")
      .test("optional-password", "Пароль слишком короткий", (value) => value === undefined || value === "" || value.length >= 3),
  }).required(),
});

const setActiveSchema = Yup.object({
  body: Yup.object({
    ids: Yup.array().of(Yup.number().strict().integer().positive().required()).required().min(1),
    is_active: Yup.boolean().strict().required(),
  }).required(),
});

class UsersValidator {
  static async create(req: Request, res: Response, next: NextFunction) {
    return validateRequest(req, res, next, createSchema);
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    return validateRequest(req, res, next, updateSchema);
  }

  static async setActive(req: Request, res: Response, next: NextFunction) {
    return validateRequest(req, res, next, setActiveSchema);
  }
}

export default UsersValidator;
