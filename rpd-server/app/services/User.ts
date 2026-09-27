import bcrypt from "bcryptjs";
import UserRepository, { type Fullname } from "../repositories/User.ts";
import RefreshSessionRepository from "../repositories/RefreshSession.ts";
import { Conflict, NotFound } from "../utils/Errors.ts";
import { pool } from "../../config/db.ts";
import TemplateWorkflow from "./TemplateWorkflow.ts";
import { USER_ROLES } from "../models/constants.ts";

type UserInput = { name: string; role: number; fullname: Fullname };
export type CreateUserInput = UserInput & { password: string };
export type UpdateUserInput = UserInput & { password?: string };

function normalize({ name, role, fullname }: UserInput) {
  return {
    name: name.trim(),
    role,
    fullname: {
      surname: fullname.surname.trim(),
      name: fullname.name.trim(),
      patronymic: fullname.patronymic.trim(),
    },
  };
}

function rethrowDuplicate(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    throw new Conflict("Пользователь с таким логином уже существует");
  }
  throw error;
}

class UserService {
  static async list() {
    return UserRepository.list();
  }

  static async create(input: CreateUserInput) {
    const hashedPassword = await bcrypt.hash(input.password, 10);
    try {
      return await UserRepository.create({ ...normalize(input), hashedPassword });
    } catch (error) {
      rethrowDuplicate(error);
    }
  }

  static async update(id: number, input: UpdateUserInput) {
    const hashedPassword = input.password ? await bcrypt.hash(input.password, 10) : undefined;
    try {
      const user = await UserRepository.update(id, {
        ...normalize(input),
        ...(hashedPassword === undefined ? {} : { hashedPassword }),
      });
      if (!user) {
        throw new NotFound("Пользователь не найден");
      }
      if (hashedPassword !== undefined) {
        await RefreshSessionRepository.deleteByUserIds([id]);
      }
      return user;
    } catch (error) {
      rethrowDuplicate(error);
    }
  }

  static async setActive(ids: number[], isActive: boolean) {
    const client = await pool.connect();
    let updatedIds: number[];
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ id: number }>("UPDATE users SET is_active=$2 WHERE id=ANY($1::int[]) AND role<>$3 RETURNING id", [ids, isActive, USER_ROLES.ADMIN]);
      updatedIds = rows.map((row) => row.id);
      const workflow = new TemplateWorkflow(pool);
      for (const id of updatedIds) await workflow.recomputeForUser(client, id);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    if (!isActive && updatedIds.length) {
      await RefreshSessionRepository.deleteByUserIds(updatedIds);
    }
    return { updated: updatedIds.length };
  }
}

export default UserService;
