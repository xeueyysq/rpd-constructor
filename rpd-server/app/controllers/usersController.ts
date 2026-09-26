import type { ParamsDictionary } from "express-serve-static-core";
import { errorMessage } from "../utils/Errors.ts";
import type { Pool } from "pg";
import type { Request, Response } from "express";
import Users from "../models/users.ts";
import bcrypt from "bcrypt";

class UsersController {
  model: Users;
    constructor(pool: Pool) {
        this.model = new Users(pool);
    };

    async findUsers (req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
        try {
            const record = await this.model.findUsers();
            res.json(record)
        } catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    }

    async addUser (req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
        try {
            const { newUser } = req.body as { newUser: { username: string; hashedPassword: string; role: number; fullname: unknown } };
            newUser.hashedPassword = await bcrypt.hash(newUser.hashedPassword, 10);
            
            const record = await this.model.addUser(newUser);
            res.json(record)
        } catch (error) {
            res.status(500).json({ message: errorMessage(error) });
        }
    }

    async updateUserRole(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
        try {
            const { userId, newRole } = req.body;
            
            const updatedUser = await this.model.updateUserRole(userId, newRole as string);
            res.json(updatedUser);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: errorMessage(error) });
        }
    }

    async deleteUser(req: Request<ParamsDictionary, unknown, Record<string, unknown>>, res: Response) {
        try {
            const { userId } = req.params;
            
            const deletedUser = await this.model.deleteUser(userId);
            res.json(deletedUser);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: errorMessage(error) });
        }
    }
}

export default UsersController;