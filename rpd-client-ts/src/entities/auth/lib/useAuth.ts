import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { AppAbility, buildAbilityFor, UserRole } from "@shared/ability";

type UserName = {
  name: string;
  surname: string;
  patronymic: string;
};

type UseAuthState = {
  ability: AppAbility;
  userName: string | undefined;
  userRole: UserRole;
  updateAbility: (roleIndex?: RoleIndex) => void;
  updateUserName: (name?: UserName) => void;
};

enum RoleIndex {
  ANONYMOUS,
  ADMIN,
  TEACHER,
  ROP,
}

const getRoleByIndex = (roleIndex?: RoleIndex): UserRole => {
  switch (roleIndex) {
    case RoleIndex.ADMIN:
      return UserRole.ADMIN;
    case RoleIndex.TEACHER:
      return UserRole.TEACHER;
    case RoleIndex.ROP:
      return UserRole.ROP;
    default:
      return UserRole.ANONYMOUS;
  }
};

export const useAuth = create<UseAuthState>()(
  immer((set) => ({
    ability: buildAbilityFor(UserRole.ANONYMOUS),
    userName: undefined,
    userRole: UserRole.ANONYMOUS,
    updateAbility: (roleIndex?: RoleIndex) => {
      const role = getRoleByIndex(roleIndex);
      set((state) => {
        state.userRole = role;
        state.ability = buildAbilityFor(role);
      });
    },
    updateUserName: (name?: UserName) => {
      set((state) => {
        state.userName = name
          ? `${name.surname} ${name.name} ${name.patronymic}`
          : "Неизвестно";
      });
    },
  }))
);
