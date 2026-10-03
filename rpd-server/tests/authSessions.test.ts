import type { Request, Response } from "express";
import type { PoolClient } from "pg";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AuthService from "../app/services/Auth.ts";
import TokenService from "../app/services/Token.ts";
import AuthController from "../app/controllers/Auth.ts";
import UserRepository from "../app/repositories/User.ts";
import { pool } from "../config/db.ts";
import { Unauthorized } from "../app/utils/Errors.ts";
import type { RequestFingerprint } from "../app/types/express.d.ts";
import { loadMigrations, runMigrations, type MigrationClient } from "../app/migrations/runner.ts";
import { fileURLToPath } from "node:url";

const fingerprint = { hash: "browser-a", components: {} };
const input = { userName: "teacher", password: "secret", fingerprint };
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const now = new Date("2026-10-03T10:00:00Z");
type Session = {
  id: number; user_id: number; sid: string; finger_print: string;
  token_hash: string; prev_token_hash: string | null; prev_valid_until: Date | null; expires_at: Date;
};

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ["Date"], now });
  const previousSecrets = { access: process.env.ACCESS_TOKEN_SECRET, refresh: process.env.REFRESH_TOKEN_SECRET };
  process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
  process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
  t.after(() => {
    if (previousSecrets.access === undefined) delete process.env.ACCESS_TOKEN_SECRET;
    else process.env.ACCESS_TOKEN_SECRET = previousSecrets.access;
    if (previousSecrets.refresh === undefined) delete process.env.REFRESH_TOKEN_SECRET;
    else process.env.REFRESH_TOKEN_SECRET = previousSecrets.refresh;
  });
  const user = { id: 42, name: "teacher", role: 2, fullname: { surname: "Иванов", name: "Иван", patronymic: "" }, is_active: true };
  const password = bcrypt.hashSync("secret", 4);
  t.mock.method(UserRepository, "getUserData", async () => ({ ...user, password }));
  const sessions = new Map<string, Session>();
  const writes: unknown[][] = [];
  const commands: string[] = [];
  let lock = Promise.resolve();
  let failRotation = false;
  let activeClient = false;

  function eligible(row: Session, tokenHash: string) {
    return row.token_hash === tokenHash || row.prev_token_hash === tokenHash && row.prev_valid_until !== null && row.prev_valid_until.getTime() > Date.now();
  }

  async function query(sql: string, params: unknown[] = []) {
    commands.push(sql);
    if (sql.startsWith("INSERT INTO refresh_sessions")) {
      // Порядок параметров соответствует SQL репозитория: user_id, sid, хэш, fingerprint, срок.
      const [id, sid, tokenHash, savedFingerprint, expiresAt] = params;
      const row: Session = { id: sessions.size + 1, user_id: Number(id), sid: String(sid), token_hash: String(tokenHash), finger_print: String(savedFingerprint), expires_at: expiresAt as Date, prev_token_hash: null, prev_valid_until: null };
      sessions.set(row.sid, row);
      writes.push(params);
      return { rows: [row], rowCount: 1 };
    }
    if (sql.startsWith("SELECT") && sql.includes("FROM refresh_sessions")) {
      assert.match(sql, /FOR UPDATE/);
      assert.match(sql, /prev_valid_until\s*>\s*NOW\(\)/i);
      assert.match(sql, /expires_at\s*>\s*NOW\(\)/i);
      const row = [...sessions.values()].find((value) => eligible(value, String(params[0])) && value.expires_at.getTime() > Date.now());
      return { rows: row ? [{ ...row, name: user.name, role: user.role, fullname: user.fullname, is_active: user.is_active }] : [] };
    }
    if (sql.startsWith("UPDATE refresh_sessions")) {
      if (failRotation) throw new Error("Ошибка сохранения сессии");
      const [sid, tokenHash, expiresAt] = params;
      const row = sessions.get(String(sid));
      assert.ok(row);
      assert.match(sql, /prev_token_hash\s*=\s*token_hash/);
      assert.match(sql, /INTERVAL '10 seconds'/i);
      row.prev_token_hash = row.token_hash;
      row.prev_valid_until = new Date(Date.now() + 10000);
      row.token_hash = String(tokenHash);
      row.expires_at = expiresAt as Date;
      writes.push(params);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM refresh_sessions")) {
      for (const [sid, row] of sessions) {
        const remove = sql.includes("expires_at") ? row.expires_at.getTime() < Date.now()
          : sql.includes("ANY") ? (params[0] as number[]).includes(row.user_id)
            : row.sid === params[0] && eligible(row, String(params[1]));
        if (remove) sessions.delete(sid);
      }
      return { rows: [], rowCount: 0 };
    }
    throw new Error(`Неожиданный запрос: ${sql}`);
  }

  t.mock.method(pool, "query", async (sql: string, params: unknown[] = []) => {
    if (activeClient) throw new Error("Пул исчерпан: клиент уже занят транзакцией");
    return query(sql, params);
  });
  t.mock.method(pool, "connect", async () => {
    let unlock: (() => void) | undefined;
    let snapshot: Map<string, Session>;
    return {
      async query(sql: string, params: unknown[] = []) {
        if (sql === "BEGIN") {
          const previous = lock;
          lock = new Promise<void>((resolve) => { unlock = resolve; });
          await previous;
          activeClient = true;
          snapshot = new Map([...sessions].map(([sid, row]) => [sid, { ...row }]));
        } else if (sql === "ROLLBACK") {
          sessions.clear();
          for (const [sid, row] of snapshot) sessions.set(sid, row);
        } else if (sql !== "COMMIT") return query(sql, params);
        commands.push(sql);
        return { rows: [] };
      },
      release() { commands.push("RELEASE"); activeClient = false; unlock?.(); },
    } as unknown as PoolClient;
  });
  return { user, sessions, writes, commands, failRotation: () => { failRotation = true; } };
}

async function refreshResponse(token: unknown, savedFingerprint: RequestFingerprint = fingerprint) {
  let status = 0;
  let body: unknown;
  const cookies: Array<{ name: string; value: string; settings: Record<string, unknown> }> = [];
  const response = {
    cookie(name: string, value: string, settings: Record<string, unknown>) { cookies.push({ name, value, settings }); return this; },
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  await AuthController.refresh({ cookies: { refreshToken: token }, fingerprint: savedFingerprint } as unknown as Request, response);
  return { status, body, cookies };
}

async function logoutResponse(token: unknown) {
  let status = 0;
  let body: unknown;
  const cookies: Array<{ name: string; settings?: Record<string, unknown> }> = [];
  const response = {
    clearCookie(name: string, settings?: Record<string, unknown>) { cookies.push({ name, settings }); return this; },
    sendStatus(value: number) { status = value; return this; },
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  await AuthController.logOut({ cookies: token === undefined ? {} : { refreshToken: token } } as unknown as Request, response);
  return { status, body, cookies };
}

for (const kind of ["без cookie", "с мусором", "с некорректной cookie", "с неверной подписью", "с просроченным токеном"]) {
  test(`logout ${kind} возвращает 200, очищает cookie и не отзывает сессии`, async (t) => {
    const fake = setup(t);
    const login = await AuthService.signIn(input);
    const payload = jwt.decode(login.refreshToken) as jwt.JwtPayload;
    const tokens: Record<string, unknown> = {
      "без cookie": undefined,
      "с мусором": "invalid",
      "с некорректной cookie": { token: login.refreshToken },
      "с неверной подписью": jwt.sign(payload, "wrong-secret"),
      "с просроченным токеном": jwt.sign({ ...payload, exp: Date.now() / 1000 - 1 }, process.env.REFRESH_TOKEN_SECRET!),
    };
    const before = fake.commands.length;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await logoutResponse(tokens[kind]);
      assert.equal(response.status, 200);
      assert.deepEqual(response.cookies, [{ name: "refreshToken", settings: { httpOnly: true, sameSite: "lax" } }]);
    }
    assert.equal(fake.sessions.size, 1);
    assert.equal(fake.commands.length, before);
  });
}

test("logout валидной cookie отзывает только свою сессию, повтор возвращает 200", async (t) => {
  const fake = setup(t);
  const a = await AuthService.signIn(input);
  const b = await AuthService.signIn({ ...input, fingerprint: { hash: "browser-b", components: {} } });
  const { sid: sidB } = await TokenService.verifyRefreshToken(b.refreshToken);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await logoutResponse(a.refreshToken);
    assert.equal(response.status, 200);
    assert.deepEqual(response.cookies, [{ name: "refreshToken", settings: { httpOnly: true, sameSite: "lax" } }]);
    assert.deepEqual([...fake.sessions.keys()], [sidB]);
  }
});

test("logout не скрывает ошибку БД и возвращает 500", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  const error = new Error("Ошибка удаления сессии");
  t.mock.method(pool, "query", async () => { throw error; });
  await assert.rejects(AuthService.logOut(login.refreshToken), (caught) => caught === error);
  const response = await logoutResponse(login.refreshToken);
  assert.equal(response.status, 500);
  assert.equal(response.body, error);
  assert.deepEqual(response.cookies, []);
  assert.equal(fake.sessions.size, 1);
});

test("два входа в одну секунду создают разные refresh JWT и независимые сессии", async (t) => {
  const fake = setup(t);
  const a = await AuthService.signIn(input);
  const b = await AuthService.signIn({ ...input, fingerprint: { hash: "browser-b", components: {} } });
  assert.notEqual(a.refreshToken, b.refreshToken);
  const claimsA = await TokenService.verifyRefreshToken(a.refreshToken);
  const claimsB = await TokenService.verifyRefreshToken(b.refreshToken);
  assert.ok(claimsA.sid);
  assert.ok(claimsA.jti);
  assert.equal(claimsA.iat, claimsB.iat);
  assert.notEqual(claimsA.sid, claimsB.sid);
  assert.notEqual(claimsA.jti, claimsB.jti);
  assert.equal(fake.sessions.size, 2);
  const refreshedA = await AuthService.refresh({ currentRefreshToken: a.refreshToken, fingerprint });
  const refreshedB = await AuthService.refresh({ currentRefreshToken: b.refreshToken, fingerprint: { hash: "browser-b", components: {} } });
  assert.ok(refreshedA.refreshToken);
  assert.ok(refreshedB.refreshToken);
  assert.equal((await TokenService.verifyRefreshToken(refreshedA.refreshToken)).sid, claimsA.sid);
  assert.notEqual((await TokenService.verifyRefreshToken(refreshedA.refreshToken)).jti, claimsA.jti);
  // Предыдущая cookie в окне тоже отзывает только A.
  await AuthService.logOut(a.refreshToken);
  assert.equal(fake.sessions.size, 1);
  await assert.rejects(AuthService.refresh({ currentRefreshToken: refreshedA.refreshToken, fingerprint }), Unauthorized);
  const remaining = await AuthService.refresh({ currentRefreshToken: refreshedB.refreshToken, fingerprint: { hash: "browser-b", components: {} } });
  assert.ok(remaining.accessToken);
  await AuthService.logOut(remaining.refreshToken);
  assert.equal(fake.sessions.size, 0);
});

test("параллельные refresh старой cookie успешны, повтор не ротирует и не ставит cookie", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  const results = await Promise.all([refreshResponse(login.refreshToken), refreshResponse(login.refreshToken)]);
  assert.deepEqual(results.map((value) => value.status), [200, 200]);
  assert.deepEqual(results.map((value) => value.cookies.length), [1, 0]);
  assert.equal(results[0].cookies[0].settings.httpOnly, true);
  assert.equal(results[0].cookies[0].settings.sameSite, "lax");
  assert.equal(fake.sessions.size, 1);
  assert.equal(fake.writes.length, 2);
  for (const result of results) {
    const body = result.body as { accessToken: string; role: number };
    assert.equal((await TokenService.verifyAccessToken(body.accessToken)).id, 42);
    assert.equal(body.role, 2);
    assert.equal("refreshToken" in body, false);
  }
  assert.equal(fake.commands.filter((sql) => sql === "COMMIT").length, 2);
});

test("повтор не продлевает окно, на границе десяти секунд старый токен даёт 401", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  const first = await refreshResponse(login.refreshToken);
  const row = [...fake.sessions.values()][0];
  const until = row.prev_valid_until!.getTime();
  t.mock.timers.tick(9000);
  assert.equal((await refreshResponse(login.refreshToken)).status, 200);
  assert.equal(row.prev_valid_until!.getTime(), until);
  t.mock.timers.tick(1000);
  const expired = await refreshResponse(login.refreshToken);
  assert.equal(expired.status, 401);
  assert.equal(expired.cookies.length, 0);
  assert.equal((await refreshResponse(first.cookies[0].value)).status, 200);
});

test("в БД передаются только SHA-256 хэши, вход удаляет просроченные сессии", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  const row = [...fake.sessions.values()][0];
  assert.equal(row.token_hash, hash(login.refreshToken));
  assert.match(row.token_hash, /^[a-f0-9]{64}$/);
  assert.equal("refresh_token" in row, false);
  const refreshed = await AuthService.refresh({ currentRefreshToken: login.refreshToken, fingerprint });
  assert.equal(row.token_hash, hash(refreshed.refreshToken!));
  assert.equal(row.prev_token_hash, hash(login.refreshToken));
  assert.equal(fake.writes.flat().includes(login.refreshToken), false);
  assert.equal(fake.writes.flat().includes(refreshed.refreshToken), false);
  t.mock.timers.tick(1296e6 + 1000);
  await AuthService.signIn(input);
  assert.equal(fake.sessions.size, 1);
});

test("неправильный fingerprint, подпись, отсутствующая и некорректная cookie дают 401 без ротации", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  const payload = jwt.decode(login.refreshToken) as jwt.JwtPayload;
  const forged = jwt.sign(payload, "wrong-secret");
  for (const response of [
    await refreshResponse(login.refreshToken, { hash: "wrong-browser", components: {} }),
    await refreshResponse(login.refreshToken, { hash: null, components: {} }),
    await refreshResponse(forged),
    await refreshResponse(undefined),
    await refreshResponse({ token: login.refreshToken }),
    await refreshResponse("invalid"),
  ]) {
    assert.equal(response.status, 401);
    assert.equal(response.cookies.length, 0);
  }
  assert.equal(fake.writes.length, 1);
  assert.equal((await refreshResponse(login.refreshToken)).status, 200);
});

test("refresh отклоняет истёкший JWT и истёкшую строку сессии", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  const row = [...fake.sessions.values()][0];
  row.expires_at = new Date(Date.now() - 1);
  assert.equal((await refreshResponse(login.refreshToken)).status, 401);
  row.expires_at = new Date(Date.now() + 2 * 1296e6);
  t.mock.timers.tick(1296e6 + 1000);
  assert.equal((await refreshResponse(login.refreshToken)).status, 401);
});

test("refresh деактивированного пользователя даёт 401 и сохраняет сессию без ротации", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  fake.user.is_active = false;
  assert.equal((await refreshResponse(login.refreshToken)).status, 401);
  assert.equal(fake.writes.length, 1);
  assert.equal(fake.sessions.size, 1);
});

test("ошибка сохранения откатывает refresh и освобождает клиент", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  fake.failRotation();
  await assert.rejects(AuthService.refresh({ currentRefreshToken: login.refreshToken, fingerprint }), /Ошибка сохранения/);
  assert.equal([...fake.sessions.values()][0].token_hash, hash(login.refreshToken));
  assert.deepEqual(fake.commands.slice(-2), ["ROLLBACK", "RELEASE"]);
});

test("ротация продлевает срок сессии, logout старым токеном вне окна её не отзывает", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  const originalExpiry = [...fake.sessions.values()][0].expires_at.getTime();
  t.mock.timers.tick(3000);
  const refreshed = await AuthService.refresh({ currentRefreshToken: login.refreshToken, fingerprint });
  const row = [...fake.sessions.values()][0];
  assert.equal(row.expires_at.getTime(), originalExpiry + 3000);
  assert.equal(row.expires_at.getTime(), (await TokenService.verifyRefreshToken(refreshed.refreshToken!)).exp * 1000);
  t.mock.timers.tick(10000);
  await AuthService.logOut(login.refreshToken);
  assert.equal(fake.sessions.size, 1);
  await AuthService.logOut(refreshed.refreshToken);
  assert.equal(fake.sessions.size, 0);
});

test("refresh проверяет соответствие sid и пользователя строке сессии", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  for (const change of [{ sid: "9c29f810-4946-4f5c-83de-f310c939c14f" }, { id: 43 }]) {
    const row = [...fake.sessions.values()][0];
    const token = jwt.sign({ ...jwt.decode(login.refreshToken) as jwt.JwtPayload, ...change }, process.env.REFRESH_TOKEN_SECRET!);
    row.token_hash = hash(token);
    assert.equal((await refreshResponse(token)).status, 401);
  }
  assert.equal(fake.writes.length, 1);
});

test("refresh работает с одним подключением, читая актуального пользователя в транзакции", async (t) => {
  const fake = setup(t);
  const login = await AuthService.signIn(input);
  fake.user.name = "new-name";
  fake.user.role = 3;
  const refreshed = await AuthService.refresh({ currentRefreshToken: login.refreshToken, fingerprint });
  const claims = await TokenService.verifyAccessToken(refreshed.accessToken);
  assert.equal(claims.userName, "new-name");
  assert.equal(claims.role, 3);
  assert.equal(refreshed.role, 3);
});

test("JWT старого формата и некорректные claims дают 401 при refresh и 200 при logout", async (t) => {
  const fake = setup(t);
  for (const claims of [
    { id: 42, role: 2, userName: "teacher" },
    { id: 42, sid: "invalid", jti: "test" },
    { id: 42, sid: "9c29f810-4946-4f5c-83de-f310c939c14f", jti: "" },
  ]) {
    const token = jwt.sign(claims, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: "15d" });
    assert.equal((await refreshResponse(token)).status, 401);
    const response = await logoutResponse(token);
    assert.equal(response.status, 200);
    assert.deepEqual(response.cookies, [{ name: "refreshToken", settings: { httpOnly: true, sameSite: "lax" } }]);
  }
  assert.equal(fake.commands.length, 0);
});

test("0002 очищает старые сессии, меняет схему и повторно не выполняется через раннер", async () => {
  const migrations = await loadMigrations(fileURLToPath(new URL("../app/migrations/versions/", import.meta.url)));
  const applied = [{ name: migrations[0].name, checksum: migrations[0].checksum }];
  const commands: string[] = [];
  let sessions = 2;
  const client = {
    async query(sql: string, params: unknown[] = []) {
      commands.push(sql);
      if (sql.includes("FROM schema_migrations")) return { rows: [...applied] };
      if (sql === "DELETE FROM refresh_sessions") sessions = 0;
      if (sql.includes("ALTER TABLE refresh_sessions")) {
        assert.equal(sessions, 0);
        assert.match(sql, /DROP COLUMN refresh_token/);
        assert.match(sql, /ADD COLUMN sid UUID NOT NULL/);
        assert.match(sql, /ADD COLUMN token_hash VARCHAR\(64\) NOT NULL/);
        assert.match(sql, /ADD COLUMN expires_at TIMESTAMPTZ NOT NULL/);
      }
      if (sql.startsWith("INSERT INTO schema_migrations")) applied.push({ name: String(params[0]), checksum: String(params[1]) });
      return { rows: [] };
    },
  } as unknown as MigrationClient;
  const quiet = { log() {}, warn() {} };
  assert.deepEqual(await runMigrations(client, migrations, quiet), ["0002_refresh_sessions"]);
  assert.equal(sessions, 0);
  assert.ok(commands.indexOf("BEGIN") < commands.indexOf("DELETE FROM refresh_sessions"));
  assert.ok(commands.indexOf("COMMIT") > commands.indexOf("DELETE FROM refresh_sessions"));
  assert.ok(commands.some((sql) => /CREATE UNIQUE INDEX .* \(token_hash\)/.test(sql)));
  assert.ok(commands.some((sql) => /CREATE INDEX .* \(expires_at\)/.test(sql)));
  const count = commands.length;
  assert.deepEqual(await runMigrations(client, migrations, quiet), []);
  assert.equal(commands.slice(count).some((sql) => sql.includes("refresh_sessions")), false);
});
