import { expect, it } from "vitest";
import { UserRole } from "@shared/ability";
import { getRoleLabel } from "./roleLabels";

it.each([
  [UserRole.ANONYMOUS, "Неавторизованный пользователь"],
  [UserRole.TEACHER, "Преподаватель"],
  [UserRole.ROP, "Руководитель образовательной программы"],
  [UserRole.ADMIN, "Администратор"],
])("показывает название роли %s", (role, label) => {
  expect(getRoleLabel(role)).toBe(label);
});
