import { useAuth } from "@entities/auth";
import { useWorkflowAction, type WorkflowAction } from "@entities/template";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { showErrorMessage } from "@shared/lib";
import { useId, useState } from "react";
import { workflowActionsLayout } from "../lib/visibleWorkflowActions";

const labels: Partial<Record<WorkflowAction, string>> = {
  start: "Взять в работу",
  finish: "Готово",
  reopen: "Снять отметку",
  accept: "Принять",
  refine: "Вернуть на доработку",
};

export function TemplateWorkflowActions({
  templateId,
  allowedActions,
  onChanged,
}: {
  templateId: number;
  allowedActions: WorkflowAction[];
  onChanged?: () => void | Promise<void>;
}) {
  const userRole = useAuth((state) => state.userRole);
  const mutation = useWorkflowAction();
  const { primary, secondary } = workflowActionsLayout(
    allowedActions,
    userRole
  );
  const menuId = useId();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  const run = async (action: WorkflowAction) => {
    try {
      await mutation.mutateAsync({
        templateId,
        action,
        ...(action === "refine" ? { comment: comment.trim() } : {}),
      });
      setOpen(false);
      setComment("");
      await onChanged?.();
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось изменить статус РПД");
    }
  };

  const handleAction = (action: WorkflowAction) => {
    setAnchorEl(null);
    if (action === "refine") setOpen(true);
    else void run(action);
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
            disabled={mutation.isPending}
            onClick={() => handleAction(primary)}
            sx={{ whiteSpace: "nowrap" }}
          >
            {labels[primary]}
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
              disabled={mutation.isPending}
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
                  disabled={mutation.isPending}
                  onClick={() => handleAction(action)}
                >
                  {labels[action]}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : null}
      </Stack>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Вернуть РПД на доработку</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Комментарий"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={!comment.trim() || mutation.isPending}
            onClick={() => void run("refine")}
          >
            Вернуть на доработку
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
