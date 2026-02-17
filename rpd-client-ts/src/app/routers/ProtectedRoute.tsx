import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { Navigate } from "react-router-dom";
import { RedirectPath } from "@shared/enums";
import { routes, roleToAvailablePath } from "./routeConfig.tsx";

interface IProtectedRoute {
  path: RedirectPath;
}

export function RoleBasedRedirect() {
  const userRole = useAuth((state) => state.userRole);
  const redirectPath =
    roleToAvailablePath[userRole]?.[0] || RedirectPath.SIGN_IN;
  return <Navigate to={redirectPath} replace />;
}

export function ProtectedRoute({ path }: IProtectedRoute) {
  const userRole = useAuth((state) => state.userRole);

  if (userRole !== UserRole.ANONYMOUS && path === RedirectPath.SIGN_IN) {
    return <Navigate to={roleToAvailablePath[userRole][0]} replace />;
  }

  if (userRole === UserRole.ANONYMOUS && path !== RedirectPath.SIGN_IN) {
    return <Navigate to={RedirectPath.SIGN_IN} replace />;
  }

  if (!roleToAvailablePath[userRole].includes(path)) {
    return <Navigate to={roleToAvailablePath[userRole][0]} replace />;
  }

  return routes[path];
}
