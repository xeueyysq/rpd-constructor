import HistoryIcon from "@mui/icons-material/History";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { ListItemIcon, Menu, MenuItem } from "@mui/material";
import type { WorkflowAction } from "@entities/template";
import { useTemplateWorkflowController } from "../model/useTemplateWorkflowController";
import { WorkflowActionIcon } from "./WorkflowActionIcon";

export function TemplateWorkflowMenu({
  onOpen,
  onOpenHistory,
  onImport,
  position,
  onClose,
  ...workflow
}: {
  templateId: number;
  allowedActions: WorkflowAction[];
  onOpen: () => void;
  onOpenHistory: () => void;
  onImport?: () => void;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const controller = useTemplateWorkflowController(workflow);
  const close = onClose;
  return (
    <>
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={position ?? undefined}
        open={Boolean(position)}
        onClose={close}
      >
        <MenuItem
          onClick={() => {
            close();
            onOpen();
          }}
        >
          <ListItemIcon>
            <OpenInBrowserIcon />
          </ListItemIcon>
          Открыть
        </MenuItem>
        {onImport ? (
          <MenuItem
            onClick={() => {
              close();
              onImport();
            }}
          >
            <ListItemIcon>
              <FileDownloadOutlinedIcon />
            </ListItemIcon>
            Импортировать
          </MenuItem>
        ) : null}
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
        {controller.actions.map((action) => (
          <MenuItem
            key={action}
            disabled={controller.isPending}
            onClick={() => {
              close();
              controller.handleAction(action);
            }}
          >
            <ListItemIcon>
              <WorkflowActionIcon action={action} />
            </ListItemIcon>
            {controller.labels[action]}
          </MenuItem>
        ))}
      </Menu>
      {controller.returnDialog}
    </>
  );
}
