import type { UserRow } from "../types/db.ts";
import type { Pool } from "pg";
import { USER_ROLES } from "./constants.ts";

class Users {
  pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findUsers() {
    try {
      const result = await this.pool.query<Pick<UserRow, "id" | "name" | "role" | "fullname">>(`
                SELECT id, name, role, fullname 
                FROM users 
                WHERE role != 1
                ORDER BY role DESC, name
            `);
      return result.rows.length ? result.rows : [];
    } catch (error) {
      console.error(error);
      throw new Error(String(error), { cause: error });
    }
  }

  async addUser(data: { username: string; hashedPassword: string; role: number; fullname: unknown }) {
    try {
      await this.pool.query(
        `
                INSERT INTO users (name, password, role, fullname)
                VALUES ($1, $2, $3, $4)
                `,
        [data.username, data.hashedPassword, data.role, data.fullname]
      );
    } catch (error) {
      console.log(error);
      throw new Error(String(error), { cause: error });
    }
  }

  async updateUserRole(userId: unknown, newRole: string) {
    try {
      const roleValue = parseInt(newRole);
      if (isNaN(roleValue) || !Object.values(USER_ROLES).includes(roleValue)) {
        throw new Error("Недопустимое значение роли");
      }

      const result = await this.pool.query<UserRow>(
        `
                UPDATE users 
                SET role = $1 
                WHERE id = $2 AND role != $3
                RETURNING *
            `,
        [roleValue, userId, USER_ROLES.ADMIN]
      );

      if (result.rows.length === 0) {
        throw new Error("Пользователь не найден или является администратором");
      }

      return result.rows[0];
    } catch (error) {
      console.error(error);
      throw new Error(error instanceof Error ? error.message : String(error), { cause: error });
    }
  }

  async deleteUser(userId: unknown) {
    try {
      const result = await this.pool.query<UserRow>(
        `
                DELETE FROM users 
                WHERE id = $1 AND role != 1
                RETURNING *
            `,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error("Пользователь не найден или является администратором");
      }

      return result.rows[0];
    } catch (error) {
      console.error(error);
      throw new Error(error instanceof Error ? error.message : String(error), { cause: error });
    }
  }
}

export default Users;
