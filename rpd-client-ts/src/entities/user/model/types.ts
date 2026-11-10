import type { UserRole } from "@shared/ability";

export interface User {
  id: number;
  name: string | null;
  has_credentials: boolean;
  role: UserRole;
  fullname: {
    surname: string;
    name: string;
    patronymic: string;
  } | null;
  is_active: boolean;
}

export type UserPayload = Pick<User, "role"> & {
  name: string;
  fullname: NonNullable<User["fullname"]>;
  password?: string;
};
