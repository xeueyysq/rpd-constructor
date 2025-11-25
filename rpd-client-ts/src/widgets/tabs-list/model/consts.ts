import { createElement } from "react";
import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import GroupIcon from "@mui/icons-material/Group";
import LogoutIcon from "@mui/icons-material/Logout";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import SegmentIcon from "@mui/icons-material/Segment";
import { RedirectPath } from "@shared/enums";

export const mainTabs = [
  {
    name: "Создание комплекта",
    path: RedirectPath.MANAGER,
    icon: createElement(AddIcon),
  },
  {
    name: "Список комплектов",
    path: RedirectPath.COMPLECTS,
    icon: createElement(ViewListIcon),
  },
  {
    name: "Список компетенций",
    path: RedirectPath.PLANNED_RESULTS,
    icon: createElement(SegmentIcon),
  },
  {
    name: "Пользователи",
    path: RedirectPath.USER_MANAGEMENT,
    icon: createElement(GroupIcon),
  },
  {
    name: "Выйти",
    icon: createElement(LogoutIcon),
  },
];

export const teacherTabs = [
  {
    name: "Список шаблонов",
    path: RedirectPath.TEMPLATES,
    icon: createElement(ViewListIcon),
  },
  {
    name: "Справочник",
    path: "",
    icon: createElement(QuestionMarkIcon),
  },
  {
    name: "Выйти",
    icon: createElement(LogoutIcon),
  },
];
