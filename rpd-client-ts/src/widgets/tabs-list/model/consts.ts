import { createElement, ReactElement } from "react";
import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import GroupIcon from "@mui/icons-material/Group";
import LogoutIcon from "@mui/icons-material/Logout";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import SegmentIcon from "@mui/icons-material/Segment";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { RedirectPath } from "@shared/enums";

export interface TabItem {
  name: string;
  /** Внутренний роут приложения (react-router). */
  path?: string;
  /** Внешняя/статическая ссылка — открывается в новой вкладке. */
  href?: string;
  icon: ReactElement;
}

/** HTML-документация лежит в public и отдаётся как статика. */
export const DOCS_URL = "/docs/index.html";

const documentationTab: TabItem = {
  name: "Документация",
  href: DOCS_URL,
  icon: createElement(MenuBookIcon),
};

export const mainTabs: TabItem[] = [
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
  documentationTab,
  {
    name: "Выйти",
    icon: createElement(LogoutIcon),
  },
];

export const teacherTabs: TabItem[] = [
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
  documentationTab,
  {
    name: "Выйти",
    icon: createElement(LogoutIcon),
  },
];
