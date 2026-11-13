/* eslint-disable react-refresh/only-export-components -- конфигурация маршрутов экспортирует JSX для роутера. */
import { lazy } from "react";
import { RedirectPath } from "@shared/enums";
import { UserRole } from "@shared/ability";

const Manager = lazy(() => import("@pages/manager"));
const TeacherInterface = lazy(() => import("@pages/teacher-interface"));
const SignIn = lazy(() => import("@pages/sign-in"));
const UserManagement = lazy(() => import("@pages/user-management"));
const FeedbackDetail = lazy(() => import("@pages/feedback-detail"));
const RpdComplectsList = lazy(() => import("@pages/rpd-complects"));
const PlannedResultsList = lazy(() => import("@pages/planned-results"));
const RpdComplectPage = lazy(() => import("@pages/rpd-complect"));
const TeacherInterfaceTemplates = lazy(
  () => import("@pages/teacher-interface-templates")
);

export const mainPages = [
  RedirectPath.COMPLECTS,
  RedirectPath.PLANNED_RESULTS,
  RedirectPath.COMPLECT,
  RedirectPath.TEMPLATE,
  RedirectPath.TEMPLATE_SUBPAGE,
];

export const roleToAvailablePath: Record<UserRole, RedirectPath[]> = {
  [UserRole.ROP]: [...mainPages, RedirectPath.MANAGER],
  [UserRole.TEACHER]: [
    RedirectPath.TEMPLATES,
    RedirectPath.TEMPLATE,
    RedirectPath.TEMPLATE_SUBPAGE,
  ],
  [UserRole.ADMIN]: [
    ...mainPages,
    RedirectPath.MANAGER,
    RedirectPath.USER_MANAGEMENT,
    RedirectPath.FEEDBACK_DETAIL,
  ],
  [UserRole.ANONYMOUS]: [RedirectPath.SIGN_IN],
};

export const routes = {
  [RedirectPath.SIGN_IN]: <SignIn />,
  [RedirectPath.MANAGER]: <Manager complectPage={<RpdComplectPage />} />,
  [RedirectPath.TEMPLATES]: <TeacherInterfaceTemplates />,
  [RedirectPath.COMPLECTS]: <RpdComplectsList />,
  [RedirectPath.PLANNED_RESULTS]: <PlannedResultsList />,
  [RedirectPath.USER_MANAGEMENT]: <UserManagement />,
  [RedirectPath.FEEDBACK_DETAIL]: <FeedbackDetail />,
  [RedirectPath.COMPLECT]: <RpdComplectPage />,
  [RedirectPath.TEMPLATE]: <TeacherInterface />,
  [RedirectPath.TEMPLATE_SUBPAGE]: <TeacherInterface />,
};
