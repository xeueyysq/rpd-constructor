import type { Request, Response } from "express";
import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import AuthController from "../app/controllers/Auth.ts";
import AuthService from "../app/services/Auth.ts";
import UserRepository from "../app/repositories/User.ts";
import RefreshSessionRepository from "../app/repositories/RefreshSession.ts";
import TokenService from "../app/services/Token.ts";

test("регистрация возвращает данные созданного пользователя", async (t) => {
  t.mock.method(UserRepository, "getUserData", async () => null);
  t.mock.method(UserRepository, "createUser", async ({ userName, hashedPassword, role }: { userName: string; hashedPassword: string; role: number }) => {
    assert.equal(userName, "test-user");
    assert.equal(role, 2);
    assert.equal(bcrypt.compareSync("password", hashedPassword), true);
    return { id: 42, role: 2 };
  });
  t.mock.method(TokenService, "generateAccessToken", async () => "access-token");
  t.mock.method(TokenService, "generateRefreshToken", async () => "refresh-token");
  t.mock.method(RefreshSessionRepository, "createRefreshSession", async ({ id, refreshToken }: { id: number; refreshToken: string }) => {
    assert.equal(id, 42);
    assert.equal(refreshToken, "refresh-token");
  });

  const result = await AuthService.signUp({
    userName: "test-user",
    password: "password",
    role: 2,
    fingerprint: { hash: "fingerprint", components: {} },
  });

  assert.equal(result.fullname, null);
  assert.equal(result.role, 2);
  assert.equal(result.accessToken, "access-token");
  assert.equal(result.refreshToken, "refresh-token");
});

test("контроллер регистрации отвечает данными сервиса", async (t) => {
  t.mock.method(AuthService, "signUp", async () => ({
    fullname: "Иванов Иван",
    role: 2,
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accessTokenExpiration: 1800,
  }));

  let responseBody;
  const response = {
    cookie: () => {},
    status(status: number) {
      assert.equal(status, 200);
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  };

  await AuthController.signUp(
    { body: { userName: "test-user", password: "password", role: 3 }, fingerprint: { hash: null, components: {} } } as Request,
    response as unknown as Response
  );

  assert.deepEqual(responseBody, {
    fullname: "Иванов Иван",
    role: 2,
    accessToken: "access-token",
    accessTokenExpiration: 1800,
  });
});
