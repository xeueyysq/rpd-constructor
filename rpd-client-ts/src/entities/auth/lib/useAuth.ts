import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { AppAbility, buildAbilityFor, UserRole } from "@shared/ability";
import {
  clearActiveRole,
  readActiveRole,
  writeActiveRole,
} from "../model/activeRoleStorage";
import { getAvailableRoles, resolveActiveRole } from "../model/rolePolicy";

type UserName = {
  name: string;
  surname: string;
  patronymic: string;
};

type UseAuthState = {
  ability: AppAbility;
  userName: string | undefined;
  primaryRole: UserRole;
  availableRoles: UserRole[];
  userRole: UserRole;
  updateAbility: (roleIndex?: RoleIndex) => void;
  updateUserName: (name?: UserName) => void;
  switchRole: (role: UserRole) => void;
  resetAuth: () => void;
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

const resolveAuthRoleState = (
  primaryRole: UserRole,
  userName: string | undefined
) => {
  const availableRoles = getAvailableRoles(primaryRole);
  const storedRole = readActiveRole(userName);
  const activeRole = resolveActiveRole(primaryRole, storedRole);

  return {
    primaryRole,
    availableRoles,
    userRole: activeRole,
    ability: buildAbilityFor(activeRole),
  };
};

export const useAuth = create<UseAuthState>()(
  immer((set, get) => ({
    ability: buildAbilityFor(UserRole.ANONYMOUS),
    userName: undefined,
    primaryRole: UserRole.ANONYMOUS,
    availableRoles: [UserRole.ANONYMOUS],
    userRole: UserRole.ANONYMOUS,
    updateAbility: (roleIndex?: RoleIndex) => {
      const primaryRole = getRoleByIndex(roleIndex);
      set((state) => {
        const next = resolveAuthRoleState(primaryRole, state.userName);
        state.primaryRole = next.primaryRole;
        state.availableRoles = next.availableRoles;
        state.userRole = next.userRole;
        state.ability = next.ability;
      });
    },
    updateUserName: (name?: UserName) => {
      set((state) => {
        state.userName = name
          ? `${name.surname} ${name.name} ${name.patronymic}`
          : undefined;
      });
      const { primaryRole, userName } = get();
      if (primaryRole !== UserRole.ANONYMOUS) {
        set((state) => {
          const next = resolveAuthRoleState(primaryRole, userName);
          state.primaryRole = next.primaryRole;
          state.availableRoles = next.availableRoles;
          state.userRole = next.userRole;
          state.ability = next.ability;
        });
      }
    },
    switchRole: (role: UserRole) => {
      const { availableRoles, userName } = get();
      if (!availableRoles.includes(role)) return;

      writeActiveRole(userName, role);
      set((state) => {
        state.userRole = role;
        state.ability = buildAbilityFor(role);
      });
    },
    resetAuth: () => {
      const { userName } = get();
      clearActiveRole(userName);
      set((state) => {
        state.userName = undefined;
        state.primaryRole = UserRole.ANONYMOUS;
        state.availableRoles = [UserRole.ANONYMOUS];
        state.userRole = UserRole.ANONYMOUS;
        state.ability = buildAbilityFor(UserRole.ANONYMOUS);
      });
    },
  }))
);
