import test from "node:test";

// Production router использует общий pool: тот же host-only контракт, что у templateImportHttpPg.
const enabled = process.env.DB_HOST === "127.0.0.1" && process.env.DB_PORT === "5433"
  && process.env.DB_NAME === "rpd_e2e" && process.env.DB_USER === "rpd_e2e"
  && process.env.DB_PASSWORD === "rpd_e2e" && process.env.ACCESS_TOKEN_SECRET === "e2e-access-token-secret-only";

test("HTTP/JWT/PostgreSQL: матрица компетенций, права, изоляция и атомарная замена", { skip: !enabled, timeout: 60_000 }, async (t) => {
  const { verifyPlannedResults } = await import("./integration/plannedResults.ts");
  await verifyPlannedResults(t);
});
