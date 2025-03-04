import { createElement } from "react";
import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import GroupIcon from "@mui/icons-material/Group";
import LogoutIcon from "@mui/icons-material/Logout";
import ChecklistIcon from "@mui/icons-material/Checklist";
import FindInPageIcon from "@mui/icons-material/FindInPage";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import SegmentIcon from "@mui/icons-material/Segment";

export const mainTabs = [
  {
    name: "Создать комплект",
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

export const complectTabs = [
  {
    name: "Выбор данных",
    page: "selectData",
    icon: createElement(ChecklistIcon),
  },
  {
    name: "Поиск комплекта",
    page: "workingType",
    icon: createElement(FindInPageIcon),
  },
  {
    name: "Комплект",
    page: "createTemplateFromExchange",
    icon: createElement(ViewListIcon),
  },
  {
    name: "Назад",
    page: "/complects",
    icon: createElement(ArrowBackIcon),
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
