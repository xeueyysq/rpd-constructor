import { describe, expect, it } from "vitest";
import { UserRole } from "../model/enums";
import { buildAbilityFor } from "./buildAbilityFor";

describe("buildAbilityFor", () => {
  it.each([
    {
      role: UserRole.ANONYMOUS,
      allowed: [["get", "auth"]] as const,
      denied: [
        ["get", "lk"],
        ["edit", "competencies"],
      ] as const,
    },
    {
      role: UserRole.TEACHER,
      allowed: [
        ["get", "teacher_interface"],
        ["get", "lk"],
        ["edit", "competencies"],
      ] as const,
      denied: [
        ["get", "rop_interface"],
        ["get", "admin_tabs"],
      ] as const,
    },
    {
      role: UserRole.ROP,
      allowed: [
        ["get", "rop_interface"],
        ["get", "lk"],
      ] as const,
      denied: [
        ["get", "teacher_interface"],
        ["edit", "competencies"],
      ] as const,
    },
    {
      role: UserRole.ADMIN,
      allowed: [
        ["get", "change_templates"],
        ["get", "admin_tabs"],
        ["get", "lk"],
      ] as const,
      denied: [
        ["get", "teacher_interface"],
        ["edit", "competencies"],
      ] as const,
    },
  ])("права роли $role", ({ role, allowed, denied }) => {
    const ability = buildAbilityFor(role);

    for (const [action, subject] of allowed) {
      expect(ability.can(action, subject)).toBe(true);
    }
    for (const [action, subject] of denied) {
      expect(ability.can(action, subject)).toBe(false);
    }
  });

  it("по умолчанию возвращает права анонимного пользователя", () => {
    expect(buildAbilityFor().can("get", "auth")).toBe(true);
    expect(buildAbilityFor().can("get", "lk")).toBe(false);
  });
});
