import { createElement } from "react";
import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import GroupIcon from "@mui/icons-material/Group";
import LogoutIcon from "@mui/icons-material/Logout";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import SegmentIcon from "@mui/icons-material/Segment";

export const mainTabs = [
  {
    name: "Создание комплекта",
    path: "/manager",
    icon: createElement(AddIcon),
  },
  {
    name: "Список комплектов",
    path: "/complects",
    icon: createElement(ViewListIcon),
  },
  {
    name: "Список компетенций",
    path: "/planned-results",
    icon: createElement(SegmentIcon),
  },
  {
    name: "Пользователи",
    path: "/users",
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
    path: "/teacher-interface-templates",
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
