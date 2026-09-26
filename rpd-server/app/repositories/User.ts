import type { UserRow } from "../types/db.ts";
import { USER_ROLES } from "../models/constants.ts";
import { pool } from "../../config/db.ts";

export type PublicUser = Pick<UserRow, "id" | "name" | "role" | "fullname" | "is_active">;
export type Fullname = { surname: string; name: string; patronymic: string };

class UserRepository {
  static async list() {
    const response = await pool.query<PublicUser>(
      "SELECT id, name, role, fullname, is_active FROM users WHERE role <> $1 ORDER BY role DESC, name",
      [USER_ROLES.ADMIN]
    );
    return response.rows;
  }

  static async getUserById(id: number) {
    const response = await pool.query<PublicUser>(
      "SELECT id, name, role, fullname, is_active FROM users WHERE id = $1",
      [id]
    );
    return response.rows[0] ?? null;
  }

  static async getUserData(userName: string) {
    const response = await pool.query<UserRow>(
      "SELECT id, name, password, role, fullname, is_active FROM users WHERE name = $1",
      [userName]
    );
    return response.rows[0] ?? null;
  }

  static async create({ name, hashedPassword, role, fullname }: { name: string; hashedPassword: string; role: number; fullname: Fullname }) {
    const response = await pool.query<PublicUser>(
      "INSERT INTO users (name, password, role, fullname) VALUES ($1, $2, $3, $4) RETURNING id, name, role, fullname, is_active",
      [name, hashedPassword, role, fullname]
    );
    return response.rows[0];
  }

  static async update(id: number, { name, role, fullname, hashedPassword }: { name: string; role: number; fullname: Fullname; hashedPassword?: string }) {
    const response = hashedPassword === undefined
      ? await pool.query<PublicUser>(
        "UPDATE users SET name = $1, role = $2, fullname = $3 WHERE id = $4 AND role <> $5 RETURNING id, name, role, fullname, is_active",
        [name, role, fullname, id, USER_ROLES.ADMIN]
      )
      : await pool.query<PublicUser>(
        "UPDATE users SET name = $1, role = $2, fullname = $3, password = $4 WHERE id = $5 AND role <> $6 RETURNING id, name, role, fullname, is_active",
        [name, role, fullname, hashedPassword, id, USER_ROLES.ADMIN]
      );
    return response.rows[0] ?? null;
  }

  static async setActive(ids: number[], isActive: boolean) {
    const response = await pool.query<{ id: number }>(
      "UPDATE users SET is_active = $2 WHERE id = ANY($1::int[]) AND role <> $3 RETURNING id",
      [ids, isActive, USER_ROLES.ADMIN]
    );
    return response.rows.map((row) => row.id);
  }
}

export default UserRepository;
