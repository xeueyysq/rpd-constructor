const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const AuthController = require("../app/controllers/Auth");
const AuthService = require("../app/services/Auth");
const UserRepository = require("../app/repositories/User");
const RefreshSessionRepository = require("../app/repositories/RefreshSession");
const TokenService = require("../app/services/Token");

test("регистрация возвращает данные созданного пользователя", async (t) => {
  t.mock.method(UserRepository, "getUserData", async () => null);
  t.mock.method(UserRepository, "createUser", async ({ userName, hashedPassword, role }) => {
    assert.equal(userName, "test-user");
    assert.equal(role, 2);
    assert.equal(bcrypt.compareSync("password", hashedPassword), true);
    return { id: 42, role: 2 };
  });
  t.mock.method(TokenService, "generateAccessToken", async () => "access-token");
  t.mock.method(TokenService, "generateRefreshToken", async () => "refresh-token");
  t.mock.method(RefreshSessionRepository, "createRefreshSession", async ({ id, refreshToken }) => {
    assert.equal(id, 42);
    assert.equal(refreshToken, "refresh-token");
  });

  const result = await AuthService.signUp({
    userName: "test-user",
    password: "password",
    role: 2,
    fingerprint: { hash: "fingerprint" },
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
    status(status) {
      assert.equal(status, 200);
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await AuthController.signUp(
    { body: { userName: "test-user", password: "password", role: 3 }, fingerprint: {} },
    response
  );

  assert.deepEqual(responseBody, {
    fullname: "Иванов Иван",
    role: 2,
    accessToken: "access-token",
    accessTokenExpiration: 1800,
  });
});
