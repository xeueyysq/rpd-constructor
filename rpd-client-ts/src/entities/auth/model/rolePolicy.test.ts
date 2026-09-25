import { describe, expect, it } from "vitest";
import { UserRole } from "@shared/ability";
import { RedirectPath } from "@shared/enums";
import {
  getAvailableRoles,
  getDefaultPathForRole,
  resolveActiveRole,
} from "./rolePolicy";

describe("rolePolicy", () => {
  it.each([
    [UserRole.ANONYMOUS, [UserRole.ANONYMOUS], RedirectPath.SIGN_IN],
    [UserRole.TEACHER, [UserRole.TEACHER], RedirectPath.TEMPLATES],
    [UserRole.ROP, [UserRole.ROP, UserRole.TEACHER], RedirectPath.COMPLECTS],
    [UserRole.ADMIN, [UserRole.ADMIN], RedirectPath.COMPLECTS],
  ])("доступные роли и маршрут для %s", (role, available, path) => {
    expect(getAvailableRoles(role)).toEqual(available);
    expect(getDefaultPathForRole(role)).toBe(path);
  });

  it("позволяет руководителю переключиться на роль преподавателя", () => {
    expect(resolveActiveRole(UserRole.ROP, UserRole.TEACHER)).toBe(
      UserRole.TEACHER
    );
  });

  it.each([
    [UserRole.ROP, UserRole.ADMIN],
    [UserRole.TEACHER, UserRole.ROP],
    [UserRole.ADMIN, UserRole.TEACHER],
    [UserRole.ANONYMOUS, UserRole.TEACHER],
  ])("отклоняет недоступную сохранённую роль для %s", (primary, stored) => {
    expect(resolveActiveRole(primary, stored)).toBe(primary);
  });

  it("при отсутствии сохранённой роли использует основную", () => {
    expect(resolveActiveRole(UserRole.ROP, null)).toBe(UserRole.ROP);
  });
});
