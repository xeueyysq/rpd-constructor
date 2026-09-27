import { useWorkflowAction, type WorkflowAction } from "@entities/template";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { showErrorMessage } from "@shared/lib";
import { useState } from "react";

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
  const mutation = useWorkflowAction();
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

  return (
    <>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        {allowedActions
          .filter((action) => labels[action])
          .map((action) => (
            <Button
              key={action}
              size="small"
              variant="outlined"
              disabled={mutation.isPending}
              onClick={() =>
                action === "refine" ? setOpen(true) : void run(action)
              }
            >
              {labels[action]}
            </Button>
          ))}
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
