import { UserRole } from "@shared/ability";

const storageKey = (userName: string) => `activeRole:${userName}`;

export function readActiveRole(userName: string | undefined): UserRole | null {
  if (!userName) return null;
  const raw = sessionStorage.getItem(storageKey(userName));
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Object.values(UserRole).includes(parsed)) return null;
  return parsed as UserRole;
}

export function writeActiveRole(
  userName: string | undefined,
  role: UserRole
): void {
  if (!userName) return;
  sessionStorage.setItem(storageKey(userName), String(role));
}

export function clearActiveRole(userName: string | undefined): void {
  if (!userName) return;
  sessionStorage.removeItem(storageKey(userName));
}
