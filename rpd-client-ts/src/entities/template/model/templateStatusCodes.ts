import { axiosBase } from "@shared/api";
import { showSuccessMessage, showErrorMessage } from "@shared/lib";
import DoneIcon from "@mui/icons-material/Done";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ErrorSharpIcon from "@mui/icons-material/ErrorSharp";

export interface StatusTemplateParams {
  id: number;
  userName: string | undefined;
  status: string;
}

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
    label: "Отправлен преподавателю",
    color: null,
    icon: null,
  },
  [TemplateStatusEnum.IN_PROGRESS]: {
    label: "Взят в работу",
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
  [TemplateStatusEnum.CREATED]: {
    label: "Создан",
    color: null,
    icon: null,
  },
  [TemplateStatusEnum.ON_REFINEMENT]: {
    label: "Отправлен на доработку",
    color: "error",
    icon: ErrorSharpIcon,
  },
};

export const setTemplateStatus = async (
  params: StatusTemplateParams,
  fetchData: () => Promise<void>
) => {
  try {
    const response = await axiosBase.post("set-template-status", params);
    if (response.data === "success") {
      showSuccessMessage("Статус шаблона успешно изменен");
      fetchData();
    }
  } catch (error) {
    showErrorMessage("Ошибка при изменении статуса шаблона");
    console.error(error);
  }
};
