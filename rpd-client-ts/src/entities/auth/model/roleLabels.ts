import { UserRole } from "@shared/ability";

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return "Администратор";
    case UserRole.TEACHER:
      return "Преподаватель";
    case UserRole.ROP:
      return "Руководитель образовательной программы";
    default:
      return "Неавторизованный пользователь";
  }
}
