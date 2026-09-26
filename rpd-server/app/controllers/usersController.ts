import type { Request, Response } from "express";
import UserService, { type CreateUserInput, type UpdateUserInput } from "../services/User.ts";

class UsersController {
  static async list(_req: Request, res: Response) {
    res.json(await UserService.list());
  }

  static async create(req: Request, res: Response) {
    res.status(201).json(await UserService.create(req.body as CreateUserInput));
  }

  static async update(req: Request, res: Response) {
    res.json(await UserService.update(Number(req.params.id), req.body as UpdateUserInput));
  }

  static async setActive(req: Request, res: Response) {
    const { ids, is_active } = req.body as { ids: number[]; is_active: boolean };
    res.json(await UserService.setActive(ids, is_active));
  }
}

export default UsersController;
