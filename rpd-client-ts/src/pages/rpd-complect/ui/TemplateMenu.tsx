import { useAuth } from "@entities/auth";
import {
  setTemplateStatus,
  TemplateStatusEnum,
} from "@entities/template/index.ts";
import ForwardToInboxSharpIcon from "@mui/icons-material/ForwardToInboxSharp";
import HistoryIcon from "@mui/icons-material/History";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { axiosBase } from "@shared/api";
import {
  showErrorMessage,
  showSuccessMessage,
  showWarningMessage,
} from "@shared/lib";
import { FC, MouseEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import HistoryModal from "./HistoryModal.tsx";
import { RedirectPath } from "@shared/enums.ts";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { ImportFromComplectsDialog } from "./ImportFromComplectsDialog";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";

interface TemplateMenu {
  id: number;
  publicId?: string;
  teacher: string;
  status: string;
  fetchData: () => Promise<void>;
}

const TemplateMenu: FC<TemplateMenu> = ({
  id,
  publicId,
  teacher,
  status,
  fetchData,
}) => {
  const userName = useAuth.getState().userName;
  const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [openImportDialog, setOpenImportDialog] = useState<boolean>(false);
  const [history, setHistory] = useState(undefined);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const sendTemplateToTeacher = async (id: number, teacher: string) => {
    try {
      const teachers = teacher
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const response = await axiosBase.post("send-template-to-teacher", {
        id,
        teachers,
        teacher,
        userName,
      });

      const result =
        typeof response.data === "string"
          ? response.data
          : (response.data?.result as string | undefined);

      if (result === "UserNotFound") showErrorMessage("Пользователь не найден");
      if (result === "TemplateAlreadyBinned")
        showWarningMessage("Данный шаблон уже отправлен преподавателям(-ю)");
      if (result === "binnedSuccess") {
        const userNotFound =
          typeof response.data === "object" &&
          Array.isArray(response.data?.userNotFound)
            ? (response.data.userNotFound as string[])
            : [];
        const alreadyBinned =
          typeof response.data === "object" &&
          Array.isArray(response.data?.alreadyBinned)
            ? (response.data.alreadyBinned as string[])
            : [];

        const totalFailed = userNotFound.length + alreadyBinned.length;
        if (totalFailed < teachers.length) {
          showSuccessMessage("Шаблон успешно отправлен преподавателям(-ю)");
        }

        if (userNotFound.length) {
          showWarningMessage(
            `Не найдены пользователи: ${userNotFound.join(", ")}`
          );
        }
        if (alreadyBinned.length) {
          showWarningMessage(`Уже отправлено: ${alreadyBinned.join(", ")}`);
        }

        fetchData();
      }
    } catch (error) {
      showErrorMessage("Ошибка отправки шаблона");
      console.error(error);
    }
  };

  const getTemplateHistory = async () => {
    try {
      const response = await axiosBase.post("get-template-history", {
        id,
      });
      setHistory(response.data);
      setOpenDialog(true);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  };

  return (
    <>
      <IconButton
        id="basic-button"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <MoreHorizIcon sx={{ color: "black" }} />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <MenuItem
          onClick={() =>
            navigate(
              `${RedirectPath.TEMPLATES}/${publicId ?? id}/${TemplatePagesPath.COVER_PAGE}`
            )
          }
        >
          <ListItemIcon>
            <OpenInBrowserIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography
              variant="button"
              display="block"
              gutterBottom
              color="grey"
              m="0"
            >
              Открыть
            </Typography>
          </ListItemText>
        </MenuItem>
        {teacher.trim() !== "" && (
          <MenuItem
            onClick={() =>
              status === TemplateStatusEnum.READY
                ? setTemplateStatus(
                    {
                      id: id,
                      userName: userName,
                      status: "on_refinement",
                    },
                    fetchData
                  )
                : sendTemplateToTeacher(id, teacher)
            }
          >
            <ListItemIcon>
              <ForwardToInboxSharpIcon />
            </ListItemIcon>
            <ListItemText>
              <Typography
                variant="button"
                display="block"
                gutterBottom
                color="grey"
                m="0"
              >
                {status === TemplateStatusEnum.READY
                  ? "Отправить на доработку"
                  : "Отправить преподавателям(-ю)"}
              </Typography>
            </ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            handleClose();
            setOpenImportDialog(true);
          }}
        >
          <ListItemIcon>
            <FileDownloadOutlinedIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography
              variant="button"
              display="block"
              gutterBottom
              color="grey"
              m="0"
            >
              Импортировать
            </Typography>
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={() => getTemplateHistory()}>
          <ListItemIcon>
            <HistoryIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography
              variant="button"
              display="block"
              gutterBottom
              color="grey"
              m="0"
            >
              История шаблона
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
      {history && (
        <HistoryModal
          history={history}
          openDialog={openDialog}
          setOpenDialog={setOpenDialog}
        />
      )}
      {openImportDialog ? (
        <ImportFromComplectsDialog
          open={openImportDialog}
          targetTemplateId={id}
          onClose={() => setOpenImportDialog(false)}
          onImported={fetchData}
        />
      ) : null}
    </>
  );
};

export default TemplateMenu;
