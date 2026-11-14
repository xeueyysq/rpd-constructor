import HistoryIcon from "@mui/icons-material/History";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { ListItemIcon, Menu, MenuItem } from "@mui/material";
import type { TemplateStatusCode, WorkflowAction } from "@entities/template";
import {
  useTemplateWorkflowController,
  WorkflowActionIcon,
} from "@features/template-workflow";
import { RedirectPath, TemplatePagesPath } from "@shared/enums";
import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImportFromComplectsDialog } from "./ImportFromComplectsDialog";

interface Props {
  position: { top: number; left: number } | null;
  onClose: () => void;
  id: number | null;
  status: TemplateStatusCode;
  removedAt?: string | null;
  allowedActions: WorkflowAction[];
  onOpenHistory: () => void;
  targetLabel: string;
  discipline: string;
  publicId?: string;
  fetchData: () => Promise<void>;
  canEditTeachers: boolean;
  onEditTeachers: () => void;
}

export default function TemplateMenu({
  position,
  onClose,
  id,
  status,
  removedAt,
  allowedActions,
  onOpenHistory,
  targetLabel,
  discipline,
  publicId,
  fetchData,
  canEditTeachers,
  onEditTeachers,
}: Props) {
  const menuId = useId();
  const workflow = useTemplateWorkflowController({
    templateId: id,
    allowedActions,
    onChanged: fetchData,
  });
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const navigate = useNavigate();
  const close = onClose;
  return (
    <>
      <Menu
        id={menuId}
        anchorReference="anchorPosition"
        anchorPosition={position ?? undefined}
        open={Boolean(position)}
        onClose={close}
      >
        {id != null ? (
          <MenuItem
            disabled={workflow.isPending}
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
        {canEditTeachers && id != null ? (
          <MenuItem
            disabled={workflow.isPending}
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
        {id != null && status !== "ready" && !removedAt ? (
          <MenuItem
            disabled={workflow.isPending}
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
            disabled={workflow.isPending}
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
            <ListItemIcon>
              <WorkflowActionIcon action={action} />
            </ListItemIcon>
            {workflow.labels[action]}
          </MenuItem>
        ))}
      </Menu>
      {workflow.returnDialog}
      {openImportDialog && id != null ? (
        <ImportFromComplectsDialog
          open
          targetTemplateId={id}
          targetLabel={targetLabel}
          discipline={discipline}
          onClose={() => setOpenImportDialog(false)}
          onImported={fetchData}
        />
      ) : null}
    </>
  );
}
