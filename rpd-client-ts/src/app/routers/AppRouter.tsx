import { Loader } from "@shared/ui/";
import { ClippedDrawer } from "@widgets/drawer";
import { keys } from "lodash";
import { Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute, RoleBasedRedirect } from "@app/routers/ProtectedRoute";
import { routes } from "./routeConfig";

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route element={<ClippedDrawer />}>
            {keys(routes).map((path) => (
              <Route key={path} path={path} element={<ProtectedRoute key={`pro_${path}`} path={path} />} />
            ))}
            <Route path="*" element={<RoleBasedRedirect />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
