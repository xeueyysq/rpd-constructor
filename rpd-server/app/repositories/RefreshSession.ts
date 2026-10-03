import type { RefreshSessionRow, UserRow } from "../types/db.ts";
import type { RequestFingerprint } from "../types/express.ts";
import type { PoolClient } from "pg";
import { pool } from "../../config/db.ts";

class RefreshSessionRepository {
  static async getRefreshSession(tokenHash: string, client: PoolClient) {
    const response = await client.query<RefreshSessionRow & Pick<UserRow, "name" | "role" | "fullname" | "is_active">>(
      `SELECT refresh_sessions.*, users.name, users.role, users.fullname, users.is_active
       FROM refresh_sessions JOIN users ON users.id = refresh_sessions.user_id
       WHERE (token_hash = $1 OR (prev_token_hash = $1 AND prev_valid_until > NOW()))
         AND expires_at > NOW()
       FOR UPDATE OF refresh_sessions`,
      [tokenHash]
    );

    if (!response.rows.length) {
      return null;
    }

    return response.rows[0];
  }

  static async createRefreshSession({ id, sid, tokenHash, fingerprint, expiresAt }: { id: number; sid: string; tokenHash: string; fingerprint: RequestFingerprint; expiresAt: Date }) {
    await pool.query(
      "INSERT INTO refresh_sessions (user_id, sid, token_hash, finger_print, expires_at) VALUES ($1, $2, $3, $4, $5)",
      [id, sid, tokenHash, fingerprint.hash, expiresAt]
    );
  }

  static async rotateRefreshSession(sid: string, tokenHash: string, expiresAt: Date, client: PoolClient) {
    await client.query(
      `UPDATE refresh_sessions
       SET prev_token_hash = token_hash, prev_valid_until = NOW() + INTERVAL '10 seconds',
           token_hash = $2, expires_at = $3
       WHERE sid = $1`,
      [sid, tokenHash, expiresAt]
    );
  }

  static async deleteRefreshSession(sid: string, tokenHash: string) {
    await pool.query(
      `DELETE FROM refresh_sessions WHERE sid = $1
       AND (token_hash = $2 OR (prev_token_hash = $2 AND prev_valid_until > NOW()))`,
      [sid, tokenHash]
    );
  }

  static async deleteExpiredSessions() {
    await pool.query("DELETE FROM refresh_sessions WHERE expires_at < NOW()");
  }

  static async deleteByUserIds(ids: number[]) {
    await pool.query("DELETE FROM refresh_sessions WHERE user_id = ANY($1::int[])", [ids]);
  }
}

export default RefreshSessionRepository;
