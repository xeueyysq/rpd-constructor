import { UserRole } from "@shared/ability";

export interface User {
  id: number;
  name: string;
  fullname: {
    name: string;
    surname: string;
    patronymic: string;
  };
  role: UserRole;
}

export interface NewUser {
  username: string;
  password: string;
  role: UserRole;
  name: string;
  surname: string;
  patronymic: string;
}
