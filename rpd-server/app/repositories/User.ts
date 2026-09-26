import type { UserRow } from "../types/db.ts";
import { pool } from "../../config/db.ts";

class UserRepository {
  static async createUser({ userName, hashedPassword, role }: { userName: string; hashedPassword: string; role: number }) {
    const response = await pool.query<UserRow>(
      "INSERT INTO users (name, password, role) VALUES ($1, $2, $3) RETURNING *",
      [userName, hashedPassword, role]
    );

    return response.rows[0];
  }

  static async getUserData(userName: string) {
    const response = await pool.query<UserRow>("SELECT * FROM users WHERE name=$1", [
      userName,
    ]);

    if (!response.rows.length) {
      return null;
    }

    return response.rows[0];
  }
}

export default UserRepository;
