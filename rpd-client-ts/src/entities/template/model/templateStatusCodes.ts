import DoneIcon from "@mui/icons-material/Done";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ErrorSharpIcon from "@mui/icons-material/ErrorSharp";

export enum TemplateStatusEnum {
  ON_TEACHER = "on_teacher",
  IN_PROGRESS = "in_progress",
  READY = "ready",
  UNLOADED = "unloaded",
  CREATED = "created",
  ON_REFINEMENT = "on_refinement",
}

export const statusConfig = {
  [TemplateStatusEnum.ON_TEACHER]: {
    label: "Назначены преподаватели",
    color: null,
    icon: null,
  },
  [TemplateStatusEnum.IN_PROGRESS]: {
    label: "В работе",
    color: "secondary",
    icon: DriveFileRenameOutlineIcon,
  },
  [TemplateStatusEnum.READY]: {
    label: "Готов",
    color: "success",
    icon: DoneIcon,
  },
  [TemplateStatusEnum.UNLOADED]: {
    label: "Выгружен из 1С",
    color: null,
    icon: null,
  },
  [TemplateStatusEnum.CREATED]: { label: "Создан", color: null, icon: null },
  [TemplateStatusEnum.ON_REFINEMENT]: {
    label: "На доработке",
    color: "error",
    icon: ErrorSharpIcon,
  },
};
