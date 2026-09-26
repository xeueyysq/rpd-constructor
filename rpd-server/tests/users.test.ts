import type { NextFunction, Request, Response } from "express";
import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

import requireRole from "../app/middleware/requireRole.ts";
import { USER_ROLES } from "../app/models/constants.ts";
import UserRepository from "../app/repositories/User.ts";
import type { UserClaims } from "../app/types/express.d.ts";
import RefreshSessionRepository from "../app/repositories/RefreshSession.ts";
import AuthService from "../app/services/Auth.ts";
import UserService from "../app/services/User.ts";
import TokenService from "../app/services/Token.ts";
import { Conflict, Forbidden, NotFound, Unauthorized } from "../app/utils/Errors.ts";
import UsersValidator from "../app/validators/Users.ts";

const fullname = { surname: "Иванов", name: "Иван", patronymic: "" };
const user = { id: 42, name: "teacher", role: USER_ROLES.TEACHER, fullname, is_active: true };
const input = { name: " teacher ", role: USER_ROLES.TEACHER, fullname: { surname: " Иванов ", name: " Иван ", patronymic: " " } };
const fingerprint = { hash: "fingerprint", components: {} };

async function validate(validator: (req: Request, res: Response, next: NextFunction) => Promise<unknown>, request: object) {
  let status = 0;
  let allowed = false;
  const response = {
    status(value: number) { status = value; return this; },
    json() { return this; },
  } as Response;
  await validator(request as Request, response, () => { allowed = true; });
  return { status, allowed };
}

test("валидаторы принимают пустой новый пароль только при обновлении", async () => {
  const body = { ...input, password: "" };
  assert.deepEqual(await validate(UsersValidator.create, { body }), { status: 422, allowed: false });
  assert.deepEqual(await validate(UsersValidator.update, { params: { id: "42" }, body }), { status: 0, allowed: true });
  assert.deepEqual(await validate(UsersValidator.update, { params: { id: "42" }, body: input }), { status: 0, allowed: true });
});

test("валидатор пользователей отклоняет роль администратора и нестроковый логин", async () => {
  assert.deepEqual(await validate(UsersValidator.create, { body: { ...input, role: USER_ROLES.ADMIN, password: "secret" } }), { status: 422, allowed: false });
  assert.deepEqual(await validate(UsersValidator.create, { body: { ...input, name: 42, password: "secret" } }), { status: 422, allowed: false });
});

test("валидатор статуса требует положительные id и boolean", async () => {
  assert.deepEqual(await validate(UsersValidator.setActive, { body: { ids: [42], is_active: false } }), { status: 0, allowed: true });
  assert.deepEqual(await validate(UsersValidator.setActive, { body: { ids: [0], is_active: false } }), { status: 422, allowed: false });
  assert.deepEqual(await validate(UsersValidator.setActive, { body: { ids: [42], is_active: "false" } }), { status: 422, allowed: false });
});

test("requireRole пропускает администратора", () => {
  const calls: unknown[] = [];
  requireRole(USER_ROLES.ADMIN)({ user: { id: 1, role: USER_ROLES.ADMIN, userName: "admin" } } as Request, {} as Response, (error?: unknown) => { calls.push(error); });
  assert.deepEqual(calls, [undefined]);
});

test("requireRole отклоняет преподавателя и запрос без пользователя", () => {
  for (const request of [
    { user: { id: 2, role: USER_ROLES.TEACHER, userName: "teacher" } },
    {},
  ]) {
    let error: unknown;
    requireRole(USER_ROLES.ADMIN)(request as Request, {} as Response, (value?: unknown) => { error = value; });
    assert.ok(error instanceof Forbidden);
  }
});

test("UserService.create обрезает пробелы и хеширует пароль", async (t) => {
  t.mock.method(UserRepository, "create", async ({ name, fullname: savedFullname, hashedPassword }: Parameters<typeof UserRepository.create>[0]) => {
    assert.equal(name, "teacher");
    assert.deepEqual(savedFullname, fullname);
    assert.equal(await bcrypt.compare("secret", hashedPassword), true);
    return user;
  });

  assert.deepEqual(await UserService.create({ ...input, password: "secret" }), user);
});

test("UserService.create переводит 23505 в 409", async (t) => {
  t.mock.method(UserRepository, "create", async () => { throw { code: "23505" }; });
  await assert.rejects(UserService.create({ ...input, password: "secret" }), (error: unknown) => error instanceof Conflict && error.status === 409);
});

test("UserService.update без пароля не отзывает сессии", async (t) => {
  t.mock.method(UserRepository, "update", async (id: number, data: Parameters<typeof UserRepository.update>[1]) => {
    assert.equal(id, 42);
    assert.equal("hashedPassword" in data, false);
    assert.equal(data.name, "teacher");
    return user;
  });
  const revoke = t.mock.method(RefreshSessionRepository, "deleteByUserIds", async () => {});

  assert.deepEqual(await UserService.update(42, { ...input, password: "" }), user);
  assert.equal(revoke.mock.callCount(), 0);
});

test("UserService.update с паролем хеширует его и отзывает сессии", async (t) => {
  t.mock.method(UserRepository, "update", async (_id: number, data: Parameters<typeof UserRepository.update>[1]) => {
    assert.equal(await bcrypt.compare("new-secret", data.hashedPassword!), true);
    return user;
  });
  const revoke = t.mock.method(RefreshSessionRepository, "deleteByUserIds", async () => {});

  assert.deepEqual(await UserService.update(42, { ...input, password: "new-secret" }), user);
  assert.deepEqual(revoke.mock.calls[0]?.arguments[0], [42]);
});

test("UserService.update переводит 23505 в 409", async (t) => {
  t.mock.method(UserRepository, "update", async () => { throw { code: "23505" }; });
  await assert.rejects(UserService.update(42, input), (error: unknown) => error instanceof Conflict && error.status === 409);
});

test("UserService.update отвечает 404 для отсутствующего пользователя", async (t) => {
  t.mock.method(UserRepository, "update", async () => null);
  await assert.rejects(UserService.update(42, input), (error: unknown) => error instanceof NotFound && error.status === 404);
});

test("UserService.setActive отзывает сессии только при деактивации", async (t) => {
  t.mock.method(UserRepository, "setActive", async () => [42]);
  const revoke = t.mock.method(RefreshSessionRepository, "deleteByUserIds", async () => {});

  assert.deepEqual(await UserService.setActive([1, 42], false), { updated: 1 });
  assert.deepEqual(revoke.mock.calls[0]?.arguments[0], [42]);
  assert.deepEqual(await UserService.setActive([42], true), { updated: 1 });
  assert.equal(revoke.mock.callCount(), 1);
});

test("AuthService.signIn отклоняет неактивного пользователя после проверки пароля", async (t) => {
  const password = await bcrypt.hash("secret", 10);
  t.mock.method(UserRepository, "getUserData", async () => ({ ...user, password, is_active: false }));
  await assert.rejects(
    AuthService.signIn({ userName: "teacher", password: "secret", fingerprint }),
    (error: unknown) => error instanceof Forbidden && error.error === "Пользователь деактивирован"
  );
});

test("AuthService.refresh отклоняет отсутствующего пользователя", async (t) => {
  t.mock.method(RefreshSessionRepository, "getRefreshSession", async () => ({ finger_print: "fingerprint" }));
  t.mock.method(RefreshSessionRepository, "deleteRefreshSession", async () => {});
  t.mock.method(TokenService, "verifyRefreshToken", async () => ({ id: 42, role: 2, userName: "old-name" }));
  t.mock.method(UserRepository, "getUserById", async () => null);
  await assert.rejects(AuthService.refresh({ fingerprint, currentRefreshToken: "old-token" }), Unauthorized);
});

test("AuthService.refresh отклоняет неактивного пользователя", async (t) => {
  t.mock.method(RefreshSessionRepository, "getRefreshSession", async () => ({ finger_print: "fingerprint" }));
  t.mock.method(RefreshSessionRepository, "deleteRefreshSession", async () => {});
  t.mock.method(TokenService, "verifyRefreshToken", async () => ({ id: 42, role: 2, userName: "old-name" }));
  t.mock.method(UserRepository, "getUserById", async () => ({ ...user, is_active: false }));
  await assert.rejects(AuthService.refresh({ fingerprint, currentRefreshToken: "old-token" }), Unauthorized);
});

test("AuthService.refresh ищет по id и выпускает токены с актуальными именем и ролью", async (t) => {
  t.mock.method(RefreshSessionRepository, "getRefreshSession", async () => ({ finger_print: "fingerprint" }));
  t.mock.method(RefreshSessionRepository, "deleteRefreshSession", async () => {});
  t.mock.method(TokenService, "verifyRefreshToken", async () => ({ id: 42, role: 2, userName: "old-name" }));
  t.mock.method(UserRepository, "getUserById", async (id: number) => {
    assert.equal(id, 42);
    return { ...user, name: "new-name", role: USER_ROLES.ROP };
  });
  t.mock.method(TokenService, "generateAccessToken", async (payload: UserClaims) => {
    assert.deepEqual(payload, { id: 42, role: USER_ROLES.ROP, userName: "new-name" });
    return "access-token";
  });
  t.mock.method(TokenService, "generateRefreshToken", async () => "refresh-token");
  t.mock.method(RefreshSessionRepository, "createRefreshSession", async () => {});

  const result = await AuthService.refresh({ fingerprint, currentRefreshToken: "old-token" });
  assert.equal(result.role, USER_ROLES.ROP);
  assert.equal(result.accessToken, "access-token");
});
