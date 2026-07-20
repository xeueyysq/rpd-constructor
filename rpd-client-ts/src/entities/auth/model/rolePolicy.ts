import { UserRole } from "@shared/ability";
import { RedirectPath } from "@shared/enums";

export function getAvailableRoles(primaryRole: UserRole): UserRole[] {
  if (primaryRole === UserRole.ROP) {
    return [UserRole.ROP, UserRole.TEACHER];
  }
  return [primaryRole];
}

export function getDefaultPathForRole(role: UserRole): RedirectPath {
  switch (role) {
    case UserRole.TEACHER:
      return RedirectPath.TEMPLATES;
    case UserRole.ADMIN:
    case UserRole.ROP:
      return RedirectPath.COMPLECTS;
    default:
      return RedirectPath.SIGN_IN;
  }
}

export function resolveActiveRole(
  primaryRole: UserRole,
  storedRole: UserRole | null
): UserRole {
  const availableRoles = getAvailableRoles(primaryRole);
  if (storedRole !== null && availableRoles.includes(storedRole)) {
    return storedRole;
  }
  return primaryRole;
}
