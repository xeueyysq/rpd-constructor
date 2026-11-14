import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import PlannedResults from "../app/services/PlannedResults.ts";
import { USER_ROLES } from "../app/models/constants.ts";

test("сбой соединения: исходная ошибка сохраняется, клиент с неудачным ROLLBACK исключается из pool", async () => {
  for (const rollbackFails of [false, true]) {
    const failure = new Error("Соединение оборвано при BEGIN");
    let discarded: boolean | undefined;
    // Только отказ соединения. Сохранность SQL-данных доказывает plannedResultsHttpPg.
    const pool = { connect: async () => ({
      query: async (sql: string) => {
        if (sql === "ROLLBACK" && !rollbackFails) return { rows: [] };
        if (sql === "ROLLBACK") throw new Error("Соединение недоступно и для ROLLBACK");
        throw failure;
      },
      release: (discard: boolean) => { discarded = discard; },
    }) } as unknown as Pool;
    await assert.rejects(new PlannedResults(pool).replace({ id: 1, role: USER_ROLES.ROP, userName: "rop" }, 2,
      [{ competence: "УК-1", indicator: "—", disciplines: ["Алгоритмы"] }]), (error: unknown) => error === failure);
    assert.equal(discarded, rollbackFails);
  }
});
