import type { MigrationClient } from "../runner.ts";

export async function up(client: MigrationClient): Promise<void> {
  await client.query(`
    CREATE TABLE feedback_delivery_control (
      id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
      cooldown_until TIMESTAMPTZ,
      last_error TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO feedback_delivery_control(id) VALUES(true);
  `);
}
