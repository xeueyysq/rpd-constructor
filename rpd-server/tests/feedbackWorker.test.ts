import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { pool } from "../config/db.ts";
import { FeedbackOutbox } from "../app/services/Feedback.ts";

test("worker продолжает тики после ошибок unlock и release; не возвращает соединение с lock в пул", async (t) => {
  const originalEnabled = process.env.FEEDBACK_ENABLED;
  const originalGoogle = process.env.FEEDBACK_GOOGLE_ENABLED;
  process.env.FEEDBACK_ENABLED = "true";
  process.env.FEEDBACK_GOOGLE_ENABLED = "false";
  t.after(() => {
    if (originalEnabled === undefined) delete process.env.FEEDBACK_ENABLED;
    else process.env.FEEDBACK_ENABLED = originalEnabled;
    if (originalGoogle === undefined) delete process.env.FEEDBACK_GOOGLE_ENABLED;
    else process.env.FEEDBACK_GOOGLE_ENABLED = originalGoogle;
  });
  const setIntervalOriginal = globalThis.setInterval;
  t.mock.method(FeedbackOutbox.prototype, "retention", async () => false);
  t.mock.method(process.stderr, "write", () => true);
  for (const failure of ["unlock", "release"] as const) {
    await t.test(failure, async (s) => {
      const { startFeedbackWorker } = await import(new URL(`../app/services/feedbackWorker.ts?cleanup=${failure}`, import.meta.url).href);
      let nextTick!: () => void;
      const timers: ReturnType<typeof setInterval>[] = [];
      s.mock.method(globalThis, "setInterval", (callback: () => void) => {
        nextTick = callback;
        const timer = setIntervalOriginal(() => {}, 3_600_000);
        timers.push(timer);
        return timer;
      });
      s.after(() => timers.forEach(clearInterval));
      let connections = 0;
      const releases: boolean[] = [];
      s.mock.method(pool, "connect", async () => {
        const first = ++connections === 1;
        return {
          query: async (sql: string) => {
            if (sql.includes("pg_try_advisory_lock")) return { rows: [{ locked: true }] };
            if (first && failure === "unlock") throw new Error("synthetic unlock failure");
            return { rows: [{ pg_advisory_unlock: true }] };
          },
          release: (destroy = false) => {
            releases.push(destroy);
            if (first && failure === "release") throw new Error("synthetic release failure");
          },
        } as unknown as PoolClient;
      });
      startFeedbackWorker();
      await new Promise<void>((resolve) => setImmediate(resolve));
      nextTick();
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(connections, 2, "Следующий запланированный тик снова обслуживает очередь");
      assert.deepEqual(releases, [failure === "unlock", false], "При ошибке unlock соединение уничтожается");
    });
  }
});
