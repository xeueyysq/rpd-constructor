import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/db.ts";
import type { UserClaims } from "../types/express.ts";
import { USER_ROLES } from "../models/constants.ts";
import { Forbidden, NotFound } from "../utils/Errors.ts";
import { diagnosticFingerprint, type DiagnosticInput, type ManualInput } from "../modules/feedbackValidation.ts";
import { sheetConfig } from "./feedbackSheets.ts";

type Receipt = { id: string; code: string; warning?: string };
type GroupReceipt = { id: string; code: string; count: number };
type GroupRow = { id: string; code: string; count: number };
type DetailRow = { id: string; code: string; type: "manual" | "diagnostic"; createdAt: Date; actorId: number | null;
  goal?: string; actual?: string; blocking?: boolean; context: unknown; requestId: string | null;
  operation?: string; errorCode?: string; status?: number | null; stack?: string | null; count?: number; lastSeen?: Date; lastContext?: unknown;
  screenshotMime?: string | null; screenshotSize?: number; warning?: string | null };

async function transaction<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function activeActor(client: PoolClient, actor: UserClaims, admin = false): Promise<void> {
  const { rows } = await client.query<{ role: number; is_active: boolean }>("SELECT role,is_active FROM users WHERE id=$1 FOR SHARE", [actor.id]);
  if (!rows[0]?.is_active || rows[0].role !== actor.role || admin && rows[0].role !== USER_ROLES.ADMIN) throw new Forbidden("Нет доступа для активной роли");
}

async function group(client: PoolClient, event: Omit<DiagnosticInput, "clientEventId">, actorId: number | null): Promise<GroupReceipt> {
  const fingerprint = diagnosticFingerprint(event);
  const { rows: inserted } = await client.query<GroupRow>(`
    INSERT INTO diagnostic_groups(fingerprint,client_release,operation,route,error_code,status,stack,actor_id,request_id,context,last_context)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$10::jsonb)
    ON CONFLICT(fingerprint) DO UPDATE SET last_seen=now()
    RETURNING id,code,count`, [fingerprint, event.context.clientRelease ?? null, event.operation, event.context.route ?? null,
    event.errorCode, event.status ?? null, event.stack ?? null, actorId, event.requestId ?? null, JSON.stringify(event.context)]);
  const entry = inserted[0];
  const { rows } = await client.query<GroupRow>(`
    UPDATE diagnostic_groups SET count=count+1,last_seen=now(),actor_id=COALESCE($2,actor_id),
      request_id=COALESCE($3,request_id),last_context=$4::jsonb
    WHERE id=$1 RETURNING id,code,count`, [entry.id, actorId, event.requestId ?? null, JSON.stringify(event.context)]);
  await client.query(`INSERT INTO feedback_outbox(group_id) VALUES($1)
    ON CONFLICT(group_id) DO UPDATE SET state='pending',next_attempt_at=now(),updated_at=now()`, [entry.id]);
  return rows[0];
}

export class FeedbackService {
  private readonly database: Pool;
  constructor(database: Pool = pool) { this.database = database; }

  async manual(actor: UserClaims, input: ManualInput, screenshot?: { data: Buffer; mime: "image/png" | "image/jpeg" }): Promise<Receipt> {
    return transaction(this.database, async (client) => {
      await activeActor(client, actor);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`feedback:${actor.id}:${input.clientReportId}`]);
      const existing = await client.query<{ id: string; code: string; warning: string | null }>(
        "SELECT id,code,warning FROM feedback_reports WHERE actor_id=$1 AND client_report_id=$2", [actor.id, input.clientReportId]);
      if (existing.rows[0]) return { id: existing.rows[0].id, code: existing.rows[0].code,
        ...(existing.rows[0].warning ? { warning: existing.rows[0].warning } : {}) };

      let image = screenshot;
      let warning: string | undefined;
      if (image) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('feedback_screenshot_cap'))");
        const { rows } = await client.query<{ total: string }>("SELECT COALESCE(SUM(screenshot_size),0)::text AS total FROM feedback_reports");
        if (Number(rows[0].total) + image.data.length > 512 * 1024 * 1024) {
          image = undefined;
          warning = "Скриншот не сохранён: достигнут лимит хранения";
        }
      }
      const { rows } = await client.query<{ id: string; code: string }>(`
        INSERT INTO feedback_reports(actor_id,client_report_id,goal,actual,blocking,context,request_id,screenshot,screenshot_mime,screenshot_size,warning)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11) RETURNING id,code`,
      [actor.id, input.clientReportId, input.goal, input.actual, input.blocking, JSON.stringify(input.context), input.requestId ?? null,
        image?.data ?? null, image?.mime ?? null, image?.data.length ?? 0, warning ?? null]);
      await client.query("INSERT INTO feedback_outbox(report_id) VALUES($1)", [rows[0].id]);
      return { ...rows[0], ...(warning ? { warning } : {}) };
    });
  }

  async diagnostic(actor: UserClaims, input: DiagnosticInput): Promise<GroupReceipt> {
    return transaction(this.database, async (client) => {
      await activeActor(client, actor);
      const receipt = await client.query<{ group_id: string | null }>(`
        INSERT INTO diagnostic_event_receipts(actor_id,client_event_id) VALUES($1,$2)
        ON CONFLICT(actor_id,client_event_id) DO NOTHING RETURNING group_id`, [actor.id, input.clientEventId]);
      if (!receipt.rows.length) {
        const { rows } = await client.query<GroupRow>(`
          SELECT g.id,g.code,g.count FROM diagnostic_event_receipts r
          JOIN diagnostic_groups g ON g.id=r.group_id WHERE r.actor_id=$1 AND r.client_event_id=$2`,
        [actor.id, input.clientEventId]);
        if (!rows[0]) throw new Error("Диагностическая квитанция не найдена");
        return rows[0];
      }
      const result = await group(client, input, actor.id);
      await client.query("UPDATE diagnostic_event_receipts SET group_id=$3 WHERE actor_id=$1 AND client_event_id=$2",
        [actor.id, input.clientEventId, result.id]);
      return result;
    });
  }

  async serverFailure(event: Omit<DiagnosticInput, "clientEventId">, actor: UserClaims | null): Promise<void> {
    await transaction(this.database, async (client) => {
      const { rows } = actor ? await client.query<{ role: number; is_active: boolean }>(
        "SELECT role,is_active FROM users WHERE id=$1", [actor.id]) : { rows: [] };
      const actorId = rows[0]?.is_active && rows[0].role === actor?.role ? actor.id : null;
      await group(client, event, actorId);
    });
  }

  async detail(actor: UserClaims, id: string): Promise<DetailRow> {
    return transaction(this.database, async (client) => {
      await activeActor(client, actor, true);
      const { rows } = await client.query<DetailRow>(`
        SELECT id,code,'manual' AS type,created_at AS "createdAt",actor_id AS "actorId",goal,actual,blocking,
          context,request_id AS "requestId",screenshot_mime AS "screenshotMime",screenshot_size AS "screenshotSize",warning
        FROM feedback_reports WHERE id=$1`, [id]);
      if (rows[0]) return rows[0];
      const diagnostic = await client.query<DetailRow>(`
        SELECT id,code,'diagnostic' AS type,first_seen AS "createdAt",last_seen AS "lastSeen",actor_id AS "actorId",
          operation,error_code AS "errorCode",status,stack,context,last_context AS "lastContext",count,request_id AS "requestId"
        FROM diagnostic_groups WHERE id=$1`, [id]);
      if (!diagnostic.rows[0]) throw new NotFound("Обращение не найдено");
      return diagnostic.rows[0];
    });
  }

  async screenshot(actor: UserClaims, id: string): Promise<{ data: Buffer; mime: string }> {
    return transaction(this.database, async (client) => {
      await activeActor(client, actor, true);
      const { rows } = await client.query<{ screenshot: Buffer | null; screenshot_mime: string | null }>(
        "SELECT screenshot,screenshot_mime FROM feedback_reports WHERE id=$1", [id]);
      if (!rows[0]?.screenshot || !rows[0].screenshot_mime) throw new NotFound("Скриншот не найден");
      return { data: rows[0].screenshot, mime: rows[0].screenshot_mime };
    });
  }

  async deliveryStatus(actor: UserClaims) {
    return transaction(this.database, async (client) => {
      await activeActor(client, actor, true);
      const { rows } = await client.query<{ pending: number; leased: number; oldestPending: Date | null;
        lastError: string | null; cooldownUntil: Date | null }>(`
        SELECT count(*) FILTER (WHERE state='pending')::int AS pending,
          count(*) FILTER (WHERE state='leased')::int AS leased,
          min(updated_at) FILTER (WHERE state='pending') AS "oldestPending",
          COALESCE((SELECT last_error FROM feedback_delivery_control WHERE id=true),
            (SELECT last_error FROM feedback_outbox WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 1)) AS "lastError",
          (SELECT cooldown_until FROM feedback_delivery_control WHERE id=true) AS "cooldownUntil"
        FROM feedback_outbox`);
      const config = sheetConfig();
      return { ...rows[0], deliveryEnabled: config.enabled, deliveryReady: config.ready,
        configError: config.enabled ? config.reason : null };
    });
  }
}

export type OutboxItem = { id: string; reportId: string | null; groupId: string | null; attempts: number };
export type OutboxPayload =
  | { type: "manual"; id: string; code: string; createdAt: Date; goal: string; blocking: boolean; context: unknown }
  | { type: "diagnostic"; id: string; code: string; createdAt: Date; lastSeen: Date; operation: string;
      errorCode: string; status: number | null; count: number; context: unknown };

// Пакет доставки использует эти операции: claim ограничен 10 строками, lease можно повторить после сбоя.
export class FeedbackOutbox {
  private readonly database: Pool;
  constructor(database: Pool = pool) { this.database = database; }

  async claim(limit = 10): Promise<OutboxItem[]> {
    const count = Math.max(1, Math.min(10, Math.floor(limit)));
    const { rows } = await this.database.query<OutboxItem>(`
      WITH picked AS (SELECT id FROM feedback_outbox
        WHERE (state='pending' AND next_attempt_at<=now()) OR (state='leased' AND lease_until<now())
        ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT $1)
      UPDATE feedback_outbox o SET state='leased',lease_until=now()+interval '1 minute',attempts=attempts+1,updated_at=now()
      FROM picked WHERE o.id=picked.id
      RETURNING o.id::text AS id,o.report_id AS "reportId",o.group_id AS "groupId",o.attempts`, [count]);
    return rows;
  }

  async payload(id: string): Promise<OutboxPayload | null> {
    const { rows } = await this.database.query<{
      report_id: string | null; group_id: string | null; code: string; created_at: Date;
      last_seen: Date | null; goal: string | null; blocking: boolean | null; operation: string | null;
      error_code: string | null; status: number | null; count: number | null; context: unknown;
    }>(`
      SELECT o.report_id,o.group_id,COALESCE(r.code,g.code) AS code,
        COALESCE(r.created_at,g.first_seen) AS created_at,g.last_seen,r.goal,r.blocking,
        g.operation,g.error_code,g.status,g.count,COALESCE(r.context,g.last_context) AS context
      FROM feedback_outbox o
      LEFT JOIN feedback_reports r ON r.id=o.report_id
      LEFT JOIN diagnostic_groups g ON g.id=o.group_id
      WHERE o.id=$1 AND o.state='leased'`, [id]);
    const row = rows[0];
    if (!row) return null;
    if (row.report_id && row.goal !== null && row.blocking !== null) {
      return { type: "manual", id: row.report_id, code: row.code, createdAt: row.created_at,
        goal: row.goal, blocking: row.blocking, context: row.context };
    }
    if (row.group_id && row.last_seen && row.operation && row.error_code && row.count !== null) {
      return { type: "diagnostic", id: row.group_id, code: row.code, createdAt: row.created_at,
        lastSeen: row.last_seen, operation: row.operation, errorCode: row.error_code,
        status: row.status, count: row.count, context: row.context };
    }
    return null;
  }

  async delivered(id: string, attempts: number, providerRowId: string | null): Promise<void> {
    await this.database.query(`UPDATE feedback_outbox SET state='delivered',lease_until=NULL,delivered_at=now(),
      provider_row_id=$3,last_error=NULL,updated_at=now() WHERE id=$1 AND state='leased' AND attempts=$2`,
    [id, attempts, providerRowId]);
  }

  async failed(id: string, attempts: number, safeError: string, retryAt: Date): Promise<void> {
    const errorCode = /^[A-Z][A-Z0-9_:-]{0,79}$/.test(safeError) ? safeError : "DELIVERY_ERROR";
    await this.database.query(`UPDATE feedback_outbox SET state='pending',lease_until=NULL,last_error=$3,
      next_attempt_at=$4,updated_at=now() WHERE id=$1 AND state='leased' AND attempts=$2`,
    [id, attempts, errorCode, retryAt]);
  }

  async cooldown(safeError: string, until: Date): Promise<void> {
    const errorCode = /^[A-Z][A-Z0-9_:-]{0,79}$/.test(safeError) ? safeError : "DELIVERY_ERROR";
    await this.database.query(`UPDATE feedback_delivery_control SET cooldown_until=$1,last_error=$2,updated_at=now()
      WHERE id=true`, [until, errorCode]);
  }

  async cooldownUntil(): Promise<Date | null> {
    const { rows } = await this.database.query<{ cooldown_until: Date | null }>(
      "SELECT cooldown_until FROM feedback_delivery_control WHERE id=true");
    return rows[0]?.cooldown_until ?? null;
  }

  async retention(): Promise<boolean> {
    const screenshots = await this.database.query(`WITH old AS (
      SELECT id FROM feedback_reports WHERE created_at<now()-interval '30 days' AND screenshot IS NOT NULL
      ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED)
      UPDATE feedback_reports r SET screenshot=NULL,screenshot_mime=NULL,screenshot_size=0
      FROM old WHERE r.id=old.id`);
    const reports = await this.database.query(`WITH old AS (
      SELECT r.id FROM feedback_reports r WHERE r.created_at<now()-interval '90 days'
        AND NOT EXISTS (SELECT 1 FROM feedback_outbox o WHERE o.report_id=r.id AND o.state<>'delivered')
      ORDER BY r.created_at LIMIT 100 FOR UPDATE OF r SKIP LOCKED)
      DELETE FROM feedback_reports r USING old WHERE r.id=old.id`);
    const groups = await this.database.query(`WITH old AS (
      SELECT g.id FROM diagnostic_groups g WHERE g.last_seen<now()-interval '90 days'
        AND NOT EXISTS (SELECT 1 FROM feedback_outbox o WHERE o.group_id=g.id AND o.state<>'delivered')
      ORDER BY g.last_seen LIMIT 100 FOR UPDATE OF g SKIP LOCKED)
      DELETE FROM diagnostic_groups g USING old WHERE g.id=old.id`);
    const receipts = await this.database.query(`WITH old AS (
      SELECT actor_id,client_event_id FROM diagnostic_event_receipts
      WHERE created_at<now()-interval '90 days' ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED)
      DELETE FROM diagnostic_event_receipts r USING old
      WHERE r.actor_id=old.actor_id AND r.client_event_id=old.client_event_id`);
    return [screenshots, reports, groups, receipts].some((result) => result.rowCount === 100);
  }
}
