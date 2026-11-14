import type { MigrationClient } from "../runner.ts";

// Локальная запись всегда предшествует попытке доставки в таблицу обращений.
export async function up(client: MigrationClient): Promise<void> {
  await client.query(`
    CREATE SEQUENCE feedback_code_seq;
    CREATE TABLE feedback_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE DEFAULT ('RPD-' || nextval('feedback_code_seq')::text),
      actor_id INTEGER NOT NULL REFERENCES users(id),
      client_report_id UUID NOT NULL,
      goal TEXT NOT NULL,
      actual TEXT NOT NULL,
      blocking BOOLEAN NOT NULL,
      context JSONB NOT NULL,
      request_id UUID,
      screenshot BYTEA,
      screenshot_mime TEXT,
      screenshot_size INTEGER NOT NULL DEFAULT 0,
      warning TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (actor_id, client_report_id),
      CHECK (screenshot_size BETWEEN 0 AND 2097152),
      CHECK ((screenshot IS NULL AND screenshot_mime IS NULL AND screenshot_size = 0)
        OR (screenshot IS NOT NULL AND screenshot_mime IN ('image/png','image/jpeg') AND octet_length(screenshot) = screenshot_size))
    );
    CREATE INDEX feedback_reports_created_idx ON feedback_reports(created_at);

    CREATE TABLE diagnostic_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE DEFAULT ('RPD-' || nextval('feedback_code_seq')::text),
      fingerprint TEXT NOT NULL UNIQUE,
      client_release TEXT,
      operation TEXT NOT NULL,
      route TEXT,
      error_code TEXT NOT NULL,
      status INTEGER,
      stack TEXT,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      request_id UUID,
      context JSONB NOT NULL,
      last_context JSONB NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (count >= 0)
    );
    CREATE INDEX diagnostic_groups_last_seen_idx ON diagnostic_groups(last_seen);

    CREATE TABLE diagnostic_event_receipts (
      actor_id INTEGER NOT NULL REFERENCES users(id),
      client_event_id UUID NOT NULL,
      group_id UUID REFERENCES diagnostic_groups(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (actor_id, client_event_id)
    );
    CREATE INDEX diagnostic_event_receipts_created_idx ON diagnostic_event_receipts(created_at);

    CREATE TABLE feedback_outbox (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      report_id UUID UNIQUE REFERENCES feedback_reports(id) ON DELETE CASCADE,
      group_id UUID UNIQUE REFERENCES diagnostic_groups(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','delivered')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      lease_until TIMESTAMPTZ,
      last_error TEXT,
      delivered_at TIMESTAMPTZ,
      provider_row_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK ((report_id IS NULL) <> (group_id IS NULL))
    );
    CREATE INDEX feedback_outbox_pending_idx ON feedback_outbox(next_attempt_at, id) WHERE state <> 'delivered';
  `);
}
