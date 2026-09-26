import type { UserRole } from "@shared/ability";

export interface User {
  id: number;
  name: string;
  role: UserRole;
  fullname: {
    surname: string;
    name: string;
    patronymic: string;
  } | null;
  is_active: boolean;
}

export type UserPayload = Pick<User, "name" | "role"> & {
  fullname: NonNullable<User["fullname"]>;
  password?: string;
};
