import { lazy } from "react";
import { RedirectPath } from "@shared/enums";
import { UserRole } from "@shared/ability";

const Manager = lazy(() => import("@pages/manager"));
const RPDTemplate = lazy(() => import("@pages/rpd-template"));
const TeacherInterface = lazy(() => import("@pages/teacher-interface"));
const SignIn = lazy(() => import("@pages/sign-in"));
const UserManagement = lazy(() => import("@pages/user-management"));
const RpdComplectsList = lazy(() => import("@pages/rpd-complects"));
const PlannedResultsList = lazy(() => import("@pages/planned-results"));
const RpdComplectPage = lazy(() => import("@pages/rpd-complect"));
const TeacherInterfaceTemplates = lazy(() => import("@pages/teacher-interface-templates"));

export const mainPages = [
  RedirectPath.COMPLECTS,
  RedirectPath.MANAGER,
  RedirectPath.PLANNED_RESULTS,
  RedirectPath.COMPLECT,
  RedirectPath.TEMPLATE,
  RedirectPath.TEMPLATE_SUBPAGE,
];

export const roleToAvailablePath: Record<UserRole, RedirectPath[]> = {
  [UserRole.ROP]: mainPages,
  [UserRole.TEACHER]: [
    RedirectPath.TEMPLATES,
    RedirectPath.RPD_TEMPLATE,
    RedirectPath.TEMPLATE,
    RedirectPath.TEMPLATE_SUBPAGE,
  ],
  [UserRole.ADMIN]: [...mainPages, RedirectPath.USER_MANAGEMENT],
  [UserRole.ANONYMOUS]: [RedirectPath.SIGN_IN],
};

export const routes = {
  [RedirectPath.SIGN_IN]: <SignIn />,
  [RedirectPath.MANAGER]: <Manager />,
  [RedirectPath.TEMPLATES]: <TeacherInterfaceTemplates />,
  [RedirectPath.RPD_TEMPLATE]: <RPDTemplate />,
  [RedirectPath.COMPLECTS]: <RpdComplectsList />,
  [RedirectPath.PLANNED_RESULTS]: <PlannedResultsList />,
  [RedirectPath.USER_MANAGEMENT]: <UserManagement />,
  [RedirectPath.COMPLECT]: <RpdComplectPage />,
  [RedirectPath.TEMPLATE]: <TeacherInterface />,
  [RedirectPath.TEMPLATE_SUBPAGE]: <TeacherInterface />,
};
