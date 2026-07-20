import {
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
} from "@mui/material";

type WarningDeleteDialogProps = {
  onAccept: () => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  description: string;
};

export function WarningDeleteDialog({
  onAccept,
  open,
  setOpen,
  description,
}: WarningDeleteDialogProps) {
  return (
    <Dialog open={open} onClose={() => setOpen(false)}>
      <DialogTitle>Подтверждение</DialogTitle>
      <DialogContent>{description}</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setOpen(false)}>
          Отмена
        </Button>
        <Button variant="contained" color="error" onClick={onAccept}>
          Удалить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
