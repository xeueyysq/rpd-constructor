import type { AssignableTeacher } from "@entities/user";

export interface TeacherHint {
  name: string;
  userId: number | null;
}

export function orderTeacherOptions<T extends AssignableTeacher>(
  users: T[],
  hints: TeacherHint[]
) {
  const hintedIds = new Set(hints.map((hint) => hint.userId));
  return [...users].sort(
    (a, b) =>
      Number(hintedIds.has(b.id)) - Number(hintedIds.has(a.id)) ||
      a.fullname.localeCompare(b.fullname, "ru")
  );
}
