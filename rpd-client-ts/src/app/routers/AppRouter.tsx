import { Loader } from "@shared/ui/";
import { ClippedDrawer } from "@app/layout/ClippedDrawer";
import { keys } from "lodash";
import { Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { ProtectedRoute, RoleBasedRedirect } from "@app/routers/ProtectedRoute";
import { routes } from "./routeConfig";
import { RedirectPath } from "@shared/enums";
import { DiagnosticsRouteBridge } from "@app/providers/DiagnosticsBridge";
import { ReportProblem } from "@widgets/report-problem";
import { PageErrorBoundary } from "./PageErrorBoundary";

function PageRoute({ path }: { path: RedirectPath }) {
  const location = useLocation();
  return (
    <PageErrorBoundary key={location.pathname}>
      <Suspense fallback={<Loader />}>
        <ProtectedRoute path={path} />
      </Suspense>
    </PageErrorBoundary>
  );
}

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <DiagnosticsRouteBridge />
      <ReportProblem />
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route element={<ClippedDrawer />}>
            <Route
              path={RedirectPath.PLANNED_RESULTS}
              element={<Navigate to={RedirectPath.COMPLECTS} replace />}
            />
            {keys(routes).map((path) => (
              <Route
                key={path}
                path={path}
                element={<PageRoute path={path as RedirectPath} />}
              />
            ))}
            <Route path="*" element={<RoleBasedRedirect />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
