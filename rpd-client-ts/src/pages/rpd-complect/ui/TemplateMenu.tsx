import HistoryIcon from "@mui/icons-material/History";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import type { WorkflowAction } from "@entities/template";
import { useTemplateWorkflowController } from "@features/template-workflow";
import { RedirectPath, TemplatePagesPath } from "@shared/enums";
import { useId, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ImportFromComplectsDialog } from "./ImportFromComplectsDialog";

interface Props {
  id: number | null;
  allowedActions: WorkflowAction[];
  onOpenHistory: () => void;
  onCreateTemplate: () => Promise<void>;
  publicId?: string;
  fetchData: () => Promise<void>;
  canEditTeachers: boolean;
  onEditTeachers: () => void;
}

export default function TemplateMenu({
  id,
  allowedActions,
  onOpenHistory,
  onCreateTemplate,
  publicId,
  fetchData,
  canEditTeachers,
  onEditTeachers,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const menuId = useId();
  const workflow = useTemplateWorkflowController({
    templateId: id,
    allowedActions,
    onChanged: fetchData,
  });
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const navigate = useNavigate();
  const close = () => setAnchorEl(null);
  return (
    <>
      <IconButton
        aria-label="Меню шаблона"
        aria-haspopup="menu"
        aria-controls={anchorEl ? menuId : undefined}
        aria-expanded={Boolean(anchorEl)}
        disabled={workflow.isPending}
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          setAnchorEl(event.currentTarget)
        }
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
      >
        {id == null ? (
          <MenuItem
            onClick={() => {
              close();
              void onCreateTemplate();
            }}
          >
            Создать
          </MenuItem>
        ) : null}
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
            {id == null
              ? "Назначить преподавателей"
              : "Изменить преподавателей"}
          </MenuItem>
        ) : null}
        {id != null ? (
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
        ) : null}
        {id != null ? (
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
        ) : null}
        {id != null ? (
          <MenuItem
            onClick={() => {
              close();
              onOpenHistory();
            }}
          >
            <ListItemIcon>
              <HistoryIcon />
            </ListItemIcon>
            История шаблона
          </MenuItem>
        ) : null}
        {workflow.actions.map((action) => (
          <MenuItem
            key={action}
            disabled={workflow.isPending}
            onClick={() => {
              close();
              workflow.handleAction(action);
            }}
          >
            {workflow.labels[action]}
          </MenuItem>
        ))}
      </Menu>
      {workflow.returnDialog}
      {openImportDialog && id != null ? (
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
