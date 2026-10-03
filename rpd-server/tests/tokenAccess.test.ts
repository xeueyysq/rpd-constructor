import type { NextFunction, Request, Response } from "express";
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import TokenService from "../app/services/Token.ts";
import requireRole from "../app/middleware/requireRole.ts";
import { Forbidden, Unauthorized } from "../app/utils/Errors.ts";

const claims = { id: 42, role: 2, userName: "teacher" };

function setup(t: TestContext) {
  const previous = process.env.ACCESS_TOKEN_SECRET;
  process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
  t.after(() => {
    if (previous === undefined) delete process.env.ACCESS_TOKEN_SECRET;
    else process.env.ACCESS_TOKEN_SECRET = previous;
  });
}

async function check(authorization?: string) {
  const request = { headers: { authorization } } as Request;
  const errors: unknown[] = [];
  await TokenService.checkAccess(request, {} as Response, (error?: unknown) => { errors.push(error); });
  assert.equal(errors.length, 1);
  return { request, error: errors[0] };
}

test("отсутствующий, истёкший и недействительный access JWT дают 401", async (t) => {
  setup(t);
  const expired = jwt.sign(claims, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: -1 });
  const wrongSignature = jwt.sign(claims, "wrong-secret");
  for (const authorization of [undefined, "Bearer", "Bearer invalid", `Bearer ${expired}`, `Bearer ${wrongSignature}`]) {
    const { error, request } = await check(authorization);
    assert.ok(error instanceof Unauthorized);
    assert.equal(error.status, 401);
    assert.equal(request.user, undefined);
  }
});

test("действительный access JWT пропускает запрос, запрет по роли остаётся 403", async (t) => {
  setup(t);
  const token = await TokenService.generateAccessToken(claims);
  const { request, error } = await check(`Bearer ${token}`);
  assert.equal(error, undefined);
  assert.equal(request.user?.id, 42);
  let roleError: unknown;
  requireRole(1)(request, {} as Response, ((value?: unknown) => { roleError = value; }) as NextFunction);
  assert.ok(roleError instanceof Forbidden);
  assert.equal(roleError.status, 403);
});
