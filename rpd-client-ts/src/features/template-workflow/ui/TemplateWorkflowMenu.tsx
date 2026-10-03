import HistoryIcon from "@mui/icons-material/History";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import { IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import type { WorkflowAction } from "@entities/template";
import { useId, useState } from "react";
import { useTemplateWorkflowController } from "../model/useTemplateWorkflowController";
import { WorkflowActionIcon } from "./WorkflowActionIcon";

export function TemplateWorkflowMenu({
  onOpen,
  onOpenHistory,
  ...workflow
}: {
  templateId: number;
  allowedActions: WorkflowAction[];
  onOpen: () => void;
  onOpenHistory: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const controller = useTemplateWorkflowController(workflow);
  const menuId = useId();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const close = () => setAnchorEl(null);
  return (
    <>
      <IconButton
        size="small"
        aria-label="Меню шаблона"
        aria-haspopup="menu"
        aria-controls={anchorEl ? menuId : undefined}
        aria-expanded={Boolean(anchorEl)}
        disabled={controller.isPending}
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
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
