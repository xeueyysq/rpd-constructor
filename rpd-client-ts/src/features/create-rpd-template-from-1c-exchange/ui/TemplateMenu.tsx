import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { FC, MouseEvent, useState } from "react";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { useAuth } from "@entities/auth";
import { useNavigate } from "react-router-dom";
import HistoryModal from "./HistoryModal.tsx";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import HistoryIcon from "@mui/icons-material/History";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useStore } from "@shared/hooks";
import { TemplateStatusEnum } from "@entities/template/index.ts";
import ForwardToInboxSharpIcon from "@mui/icons-material/ForwardToInboxSharp";
import { setTemplateStatus } from "@entities/template/index.ts";

interface TemplateMenu {
  id: number;
  teacher: string;
  status: string;
  fetchData: () => Promise<void>;
}

const TemplateMenu: FC<TemplateMenu> = ({ id, teacher, status, fetchData }) => {
  const { setJsonData } = useStore();
  const userName = useAuth.getState().userName;
  const [anchorEl, setAnchorEl] = useState<null | HTMLButtonElement>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [history, setHistory] = useState(undefined);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();
  const { setTabState } = useStore();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const sendTemplateToTeacher = async (id: number, teacher: string) => {
    try {
      const response = await axiosBase.post("send-template-to-teacher", {
        id,
        teacher,
        userName,
      });

      if (response.data === "UserNotFound")
        showErrorMessage("Ошибка. Пользователь не найден");
      if (response.data === "TemplateAlreadyBinned")
        showErrorMessage("Ошибка. Данный шаблон уже отправлен преподавателю");
      if (response.data === "binnedSuccess") {
        showSuccessMessage("Шаблон успешно отправлен преподавателю");
        fetchData();
      }
    } catch (error) {
      showErrorMessage("Ошибка отправки шаблона");
      console.error(error);
    }
  };

  const uploadTemplateData = async () => {
    try {
      const response = await axiosBase.post("rpd-profile-templates", {
        id,
      });
      setJsonData(response.data);
      setTabState("createTemplateFromExchange", true);
      navigate("/teacher-interface");
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
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
        size="small"
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
        <MenuItem onClick={() => uploadTemplateData()}>
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
        {!(
          status === TemplateStatusEnum.ON_TEACHER ||
          status === TemplateStatusEnum.IN_PROGRESS
        ) && (
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
                  : "Отправить преподавателю"}
              </Typography>
            </ListItemText>
          </MenuItem>
        )}
        {/* <MenuItem>
          <ListItemIcon>
            <DeleteForeverIcon />
          </ListItemIcon>
          <ListItemText>
            <Typography
              variant="button"
              display="block"
              gutterBottom
              color="grey"
              m="0"
            >
              Удалить
            </Typography>
          </ListItemText>
        </MenuItem> */}
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
    </>
  );
};

export default TemplateMenu;
