import { useAuth } from "@entities/auth";
import { useWorkflowAction, type WorkflowAction } from "@entities/template";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { showErrorMessage } from "@shared/lib";
import { useState } from "react";
import {
  visibleWorkflowActions,
  workflowActionsLayout,
} from "../lib/visibleWorkflowActions";

const labels: Partial<Record<WorkflowAction, string>> = {
  start: "Взять в работу",
  finish: "Готово",
  reopen: "Снять отметку",
  accept: "Принять",
  refine: "Вернуть на доработку",
};

export function useTemplateWorkflowController({
  templateId,
  allowedActions,
  onChanged,
}: {
  templateId: number | null;
  allowedActions: WorkflowAction[];
  onChanged?: () => void | Promise<void>;
}) {
  const userRole = useAuth((state) => state.userRole);
  const mutation = useWorkflowAction();
  const { primary, secondary } = workflowActionsLayout(
    allowedActions,
    userRole
  );
  const actions = visibleWorkflowActions(allowedActions, userRole);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setComment("");
  };
  const run = async (action: WorkflowAction) => {
    if (templateId == null || mutation.isPending || !actions.includes(action))
      return;
    if (action === "refine" && !comment.trim()) return;
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
    if (mutation.isPending || !actions.includes(action)) return;
    if (action === "refine") setOpen(true);
    else void run(action);
  };

  const returnDialog = (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Вернуть РПД на доработку</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          disabled={mutation.isPending}
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
        <Button disabled={mutation.isPending} onClick={close}>
          Отмена
        </Button>
        <Button
          variant="contained"
          disabled={!comment.trim() || mutation.isPending}
          onClick={() => void run("refine")}
        >
          Вернуть на доработку
        </Button>
      </DialogActions>
    </Dialog>
  );
  return {
    actions,
    primary,
    secondary,
    labels,
    handleAction,
    isPending: mutation.isPending,
    returnDialog,
  };
}
