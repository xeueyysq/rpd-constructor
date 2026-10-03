import type { MigrationClient } from "../runner.ts";

// Старые сессии отзываются при обновлении: пользователи входят заново.
export async function up(client: MigrationClient): Promise<void> {
  await client.query("DELETE FROM refresh_sessions");
  await client.query(`
    ALTER TABLE refresh_sessions
      DROP COLUMN refresh_token,
      ADD COLUMN sid UUID NOT NULL DEFAULT gen_random_uuid(),
      ADD COLUMN token_hash VARCHAR(64) NOT NULL,
      ADD COLUMN prev_token_hash VARCHAR(64),
      ADD COLUMN prev_valid_until TIMESTAMPTZ,
      ADD COLUMN expires_at TIMESTAMPTZ NOT NULL;
  `);
  await client.query("CREATE UNIQUE INDEX refresh_sessions_sid_idx ON refresh_sessions (sid)");
  await client.query("CREATE UNIQUE INDEX refresh_sessions_token_hash_idx ON refresh_sessions (token_hash)");
  await client.query("CREATE INDEX refresh_sessions_prev_token_hash_idx ON refresh_sessions (prev_token_hash) WHERE prev_token_hash IS NOT NULL");
  await client.query("CREATE INDEX refresh_sessions_expires_at_idx ON refresh_sessions (expires_at)");
}
