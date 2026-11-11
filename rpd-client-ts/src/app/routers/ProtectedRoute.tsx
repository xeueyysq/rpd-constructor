import { getAuthReturnPolicy, useAuth } from "@entities/auth";
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
  const returnPolicy = getAuthReturnPolicy();

  if (userRole !== UserRole.ANONYMOUS && path === RedirectPath.SIGN_IN) {
    const state = location.state as {
      from?: unknown;
      returnPathVersion?: number;
    } | null;
    const from =
      (state?.returnPathVersion ?? 0) === returnPolicy.version
        ? state?.from
        : undefined;
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
        state={
          returnPolicy.remember
            ? {
                from: location.pathname + location.search + location.hash,
                returnPathVersion: returnPolicy.version,
              }
            : null
        }
        replace
      />
    );
  }

  if (!roleToAvailablePath[userRole].includes(path)) {
    return <Navigate to={roleToAvailablePath[userRole][0]} replace />;
  }

  return routes[path];
}
