import { pool } from "../../config/db.ts";
import type { PoolClient } from "pg";
import { FeedbackOutbox } from "./Feedback.ts";
import { DeliveryError, FeedbackSheets, sheetConfig } from "./feedbackSheets.ts";

const LOCK_KEY = 70_451_129;
const outbox = new FeedbackOutbox();
let running = false;
let nextRetention = 0;

function deliveryRetryDelay(attempts: number): number {
  const capped = Math.max(0, Math.min(attempts - 1, 7));
  return Math.min(3_600_000, 30_000 * 2 ** capped) + Math.floor(Math.random() * 10_000);
}

async function tick(): Promise<void> {
  if (running || process.env.FEEDBACK_ENABLED !== "true") return;
  running = true;
  let client: PoolClient | undefined;
  let locked = false;
  try {
    client = await pool.connect();
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) return;
    locked = true;
    if (Date.now() >= nextRetention) {
      const more = await outbox.retention();
      nextRetention = Date.now() + (more ? 15_000 : 3_600_000);
    }
    const config = sheetConfig();
    if (!config.ready) return;
    const until = await outbox.cooldownUntil();
    if (until && until.getTime() > Date.now()) return;
    const sheets = new FeedbackSheets(config);
    for (let i = 0; i < 10; i++) {
      const item = (await outbox.claim(1))[0];
      if (!item) break;
      try {
        const payload = await outbox.payload(item.id);
        if (!payload) continue; // Новое событие уже вернуло группу в pending.
        await sheets.sync(payload);
        await outbox.delivered(item.id, null);
      } catch (error) {
        const code = error instanceof DeliveryError ? error.code : "DELIVERY_ERROR";
        const providerCooldown = error instanceof DeliveryError && error.providerCooldown;
        const retryAt = new Date(Date.now() + (providerCooldown
          ? Math.max(300_000, deliveryRetryDelay(item.attempts)) : deliveryRetryDelay(item.attempts)));
        await outbox.failed(item.id, code, retryAt);
        if (providerCooldown) {
          await outbox.cooldown(code, retryAt);
          break;
        }
      }
    }
  } finally {
    if (client) {
      try { if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]); }
      finally { client.release(); }
    }
    running = false;
  }
}

export function startFeedbackWorker(): void {
  if (process.env.FEEDBACK_ENABLED !== "true") return;
  const run = () => { void tick().catch(() => {
    // Очередь сохраняется в PostgreSQL. Ошибки обслуживания не попадают в телеметрию.
    try { process.stderr.write("Не удалось обслужить очередь обращений\n"); } catch { /* завершаемся */ }
  }); };
  run();
  setInterval(run, 15_000).unref();
}
