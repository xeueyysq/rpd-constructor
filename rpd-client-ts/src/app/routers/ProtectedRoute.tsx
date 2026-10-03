import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { Navigate, useLocation } from "react-router-dom";
import { RedirectPath } from "@shared/enums";
import { routes, roleToAvailablePath } from "./routeConfig.tsx";
import { resolveReturnPath } from "./lib/returnPath";

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
  const location = useLocation();

  if (userRole !== UserRole.ANONYMOUS && path === RedirectPath.SIGN_IN) {
    const from = (location.state as { from?: unknown } | null)?.from;
    const redirectPath = resolveReturnPath(
      from,
      roleToAvailablePath[userRole],
      roleToAvailablePath[userRole][0]
    );
    return <Navigate to={redirectPath} replace />;
  }

  if (userRole === UserRole.ANONYMOUS && path !== RedirectPath.SIGN_IN) {
    return (
      <Navigate
        to={RedirectPath.SIGN_IN}
        state={{ from: location.pathname + location.search + location.hash }}
        replace
      />
    );
  }

  if (!roleToAvailablePath[userRole].includes(path)) {
    return <Navigate to={roleToAvailablePath[userRole][0]} replace />;
  }

  return routes[path];
}
