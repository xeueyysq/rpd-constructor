import HistoryIcon from "@mui/icons-material/History";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { axiosBase } from "@shared/api";
import { RedirectPath, TemplatePagesPath } from "@shared/enums";
import { showErrorMessage } from "@shared/lib";
import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import HistoryModal, { type HistoryEvent } from "./HistoryModal";
import { ImportFromComplectsDialog } from "./ImportFromComplectsDialog";

interface Props {
  id: number;
  publicId?: string;
  fetchData: () => Promise<void>;
  canEditTeachers: boolean;
  onEditTeachers: () => void;
}

export default function TemplateMenu({
  id,
  publicId,
  fetchData,
  canEditTeachers,
  onEditTeachers,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [history, setHistory] = useState<HistoryEvent[] | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const navigate = useNavigate();
  const close = () => setAnchorEl(null);
  const getHistory = async () => {
    close();
    try {
      const { data } = await axiosBase.post<HistoryEvent[]>(
        "get-template-history",
        { id }
      );
      setHistory(data);
    } catch (error) {
      console.error(error);
      showErrorMessage("Ошибка при получении истории");
    }
  };
  return (
    <>
      <IconButton
        aria-label="Меню шаблона"
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          setAnchorEl(event.currentTarget)
        }
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close}>
        {canEditTeachers ? (
          <MenuItem
            onClick={() => {
              close();
              onEditTeachers();
            }}
          >
            <ListItemIcon>
              <EditOutlinedIcon />
            </ListItemIcon>
            Изменить преподавателей
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            close();
            navigate(
              `${RedirectPath.TEMPLATES}/${publicId ?? id}/${TemplatePagesPath.COVER_PAGE}`
            );
          }}
        >
          <ListItemIcon>
            <OpenInBrowserIcon />
          </ListItemIcon>
          Открыть
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            setOpenImportDialog(true);
          }}
        >
          <ListItemIcon>
            <FileDownloadOutlinedIcon />
          </ListItemIcon>
          Импортировать
        </MenuItem>
        <MenuItem onClick={() => void getHistory()}>
          <ListItemIcon>
            <HistoryIcon />
          </ListItemIcon>
          История шаблона
        </MenuItem>
      </Menu>
      {history ? (
        <HistoryModal
          history={history}
          openDialog={Boolean(history)}
          setOpenDialog={(open) => {
            if (!open) setHistory(null);
          }}
        />
      ) : null}
      {openImportDialog ? (
        <ImportFromComplectsDialog
          open
          targetTemplateId={id}
          appendParagraph
          onClose={() => setOpenImportDialog(false)}
          onImported={fetchData}
        />
      ) : null}
    </>
  );
}
