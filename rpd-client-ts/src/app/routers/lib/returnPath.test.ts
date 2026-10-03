import { describe, expect, it } from "vitest";
import { UserRole } from "@shared/ability";
import { RedirectPath } from "@shared/enums";
import { roleToAvailablePath } from "../routeConfig";
import { resolveReturnPath } from "./returnPath";

function returnPath(from: unknown, role = UserRole.ROP) {
  const available = roleToAvailablePath[role];
  return resolveReturnPath(from, available, available[0]);
}

describe("возврат на исходную страницу после входа", () => {
  it.each([UserRole.ROP, UserRole.TEACHER, UserRole.ADMIN])(
    "сохраняет раздел, query и hash для роли %s",
    (role) => {
      const path = "/templates/aaaaaaaaaaaa/aimsPage?tab=goals#section";
      expect(returnPath(path, role)).toBe(path);
      expect(returnPath("/templates/aaaaaaaaaaaa", role)).toBe(
        "/templates/aaaaaaaaaaaa"
      );
    }
  );

  it("сопоставляет параметры комплекта по шаблонам маршрутов", () => {
    const path =
      "/complects/11111111-1111-4111-8111-111111111111?sort=name#table";
    expect(returnPath(path)).toBe(path);
  });

  it("учитывает активную роль преподавателя и отклоняет маршрут РОП", () => {
    expect(returnPath("/complects/123", UserRole.TEACHER)).toBe(
      RedirectPath.TEMPLATES
    );
    expect(returnPath("/users", UserRole.ROP)).toBe(RedirectPath.COMPLECTS);
    expect(returnPath("/users", UserRole.ADMIN)).toBe(
      RedirectPath.USER_MANAGEMENT
    );
  });

  it.each([
    undefined,
    null,
    {},
    { pathname: "/templates" },
    42,
    "",
    "https://other.test/templates/id",
    "//other.test/templates/id",
    "javascript:alert(1)",
    "templates/id",
    "/\\other.test/templates/id",
    "/templates/id\n",
    "/sign-in",
    "/sign-in?next=/templates#form",
    "/SIGN-IN/",
    "/templates/id/../../sign-in",
    "/templates/%2e%2e/sign-in",
    "/users/123",
    "/unknown",
    "/templates/id/aimsPage/extra",
  ])("не принимает запрещённый или внешний адрес %j", (path) => {
    expect(returnPath(path)).toBe(RedirectPath.COMPLECTS);
  });
});
