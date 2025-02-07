import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { useUserRedirect } from "@entities/auth";
import { Loader } from "@shared/ui/";

const Manager = lazy(() => import("@pages/manager"));
const RPDTemplate = lazy(() => import("@pages/rpd-template"));
const TeacherInterface = lazy(() => import("@pages/teacher-interface"));
const SignIn = lazy(() => import("@pages/sign-in"));
const UserManagement = lazy(() => import("@pages/user-management"));
const RpdComplectsList = lazy(() => import("@pages/rpd-complects"));
const TeacherInterfaceTemplates = lazy(
  () => import("@pages/teacher-interface-tempaltes")
);
import { ClippedDrawer } from "@widgets/drawer";

export const AppRouter = () => {
  const { isUserLogged, redirectPath } = useUserRedirect();

  return (
    <Router>
      <Suspense fallback={<Loader />}>
        <Routes>
          {isUserLogged ? (
            <>
              <Route
                path="/teacher-interface-templates"
                element={<TeacherInterfaceTemplates />}
              />
              <Route element={<ClippedDrawer page="main" />}>
                <Route path="/rpd-template" element={<RPDTemplate />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/complects" element={<RpdComplectsList />} />
              </Route>
              <Route element={<ClippedDrawer page="manager" />}>
                <Route path="/manager" element={<Manager />} />
              </Route>
              <Route element={<ClippedDrawer page="teacher" />}>
                <Route
                  path="/teacher-interface"
                  element={<TeacherInterface />}
                />
              </Route>
            </>
          ) : (
            <Route path="/sign-in" element={<SignIn />} />
          )}
          <Route path="*" element={<Navigate to={redirectPath} />} />
        </Routes>
      </Suspense>
    </Router>
  );
};
