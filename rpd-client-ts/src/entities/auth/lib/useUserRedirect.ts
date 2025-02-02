import { useContext, useMemo } from "react";
import { AuthContext } from "../model/authContext.ts";
import { UserRole } from "@shared/ability";
import { useAuth } from "./useAuth.ts";

enum RedirectPath {
  SIGN_IN = "/sign-in",
  MANAGER = "/manager",
  TEACHER_INTERFACE = "/teacher-interface",
  RPD_TEMPLATE = "/rpd-template",
}

const roleToRedirectPath: Record<UserRole, RedirectPath> = {
  [UserRole.ROP]: RedirectPath.MANAGER,
  [UserRole.TEACHER]: RedirectPath.TEACHER_INTERFACE,
  [UserRole.ADMIN]: RedirectPath.RPD_TEMPLATE,
  [UserRole.ANONYMOUS]: RedirectPath.SIGN_IN,
};

type TUseUserRedirectResult = {
  redirectPath: RedirectPath;
  isUserLogged: boolean;
};

export const useUserRedirect = (): TUseUserRedirectResult => {
  const { isUserLogged } = useContext(AuthContext);
  const userRole = useAuth.getState().userRole;

  const redirectPath = useMemo(() => {
    return isUserLogged
      ? roleToRedirectPath[userRole] || RedirectPath.SIGN_IN
      : RedirectPath.SIGN_IN;
  }, [isUserLogged, userRole]);

  return { isUserLogged, redirectPath };
};
