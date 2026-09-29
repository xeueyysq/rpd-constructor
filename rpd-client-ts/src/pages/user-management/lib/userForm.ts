import { UserRole } from "@shared/ability";
import type { User, UserPayload } from "@entities/user";
import * as yup from "yup";

export type AssignableRole = UserRole.TEACHER | UserRole.ROP;

export interface UserFormValues {
  name: string;
  surname: string;
  givenName: string;
  patronymic: string;
  role: AssignableRole;
  password: string;
}

export function getUserFormDefaults(user: User | null): UserFormValues {
  return {
    name: user?.name ?? "",
    surname: user?.fullname?.surname ?? "",
    givenName: user?.fullname?.name ?? "",
    patronymic: user?.fullname?.patronymic ?? "",
    role: user?.role === UserRole.ROP ? UserRole.ROP : UserRole.TEACHER,
    password: "",
  };
}

export function buildUserPayload(
  values: UserFormValues,
  isEditing: boolean
): UserPayload {
  const password = values.password;
  return {
    name: values.name.trim(),
    role: values.role,
    fullname: {
      surname: values.surname.trim(),
      name: values.givenName.trim(),
      patronymic: values.patronymic.trim(),
    },
    ...(!isEditing || password ? { password } : {}),
  };
}

export function getUserFormSchema(isEditing: boolean) {
  return yup.object({
    name: yup
      .string()
      .trim()
      .required("Логин обязателен")
      .max(25, "Не более 25 символов"),
    surname: yup.string().trim().required("Фамилия обязательна"),
    givenName: yup.string().trim().required("Имя обязательно"),
    patronymic: yup.string().trim().defined(),
    role: yup
      .mixed<AssignableRole>()
      .oneOf([UserRole.TEACHER, UserRole.ROP])
      .required("Роль обязательна"),
    password: isEditing
      ? yup
          .string()
          .defined()
          .test(
            "optional-password",
            "От 3 до 50 символов",
            (value) => value === "" || (value.length >= 3 && value.length <= 50)
          )
      : yup
          .string()
          .required("Пароль обязателен")
          .min(3, "Не менее 3 символов")
          .max(50, "Не более 50 символов"),
  });
}
