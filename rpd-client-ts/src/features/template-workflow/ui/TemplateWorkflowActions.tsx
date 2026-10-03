import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { Button, IconButton, Menu, MenuItem, Stack } from "@mui/material";
import type { WorkflowAction } from "@entities/template";
import { useId, useState } from "react";
import { useTemplateWorkflowController } from "../model/useTemplateWorkflowController";

export function TemplateWorkflowActions(props: {
  templateId: number;
  allowedActions: WorkflowAction[];
  onChanged?: () => void | Promise<void>;
}) {
  const controller = useTemplateWorkflowController(props);
  const { primary, secondary } = controller;
  const menuId = useId();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const handleAction = (action: WorkflowAction) => {
    setAnchorEl(null);
    controller.handleAction(action);
  };
  return (
    <>
      <Stack
        direction="row"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          verticalAlign: "middle",
          flexWrap: "nowrap",
          flexShrink: 0,
          gap: 1,
        }}
      >
        {primary ? (
          <Button
            size="small"
            variant="outlined"
            disabled={controller.isPending}
            onClick={() => handleAction(primary)}
            sx={{ whiteSpace: "nowrap" }}
          >
            {controller.labels[primary]}
          </Button>
        ) : null}
        {secondary.length > 0 ? (
          <>
            <IconButton
              size="small"
              aria-label="Другие действия РПД"
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
              onClose={() => setAnchorEl(null)}
            >
              {secondary.map((action) => (
                <MenuItem
                  key={action}
                  disabled={controller.isPending}
                  onClick={() => handleAction(action)}
                >
                  {controller.labels[action]}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : null}
      </Stack>
      {controller.returnDialog}
    </>
  );
}
