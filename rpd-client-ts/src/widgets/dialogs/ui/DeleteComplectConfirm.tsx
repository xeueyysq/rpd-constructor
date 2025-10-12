import { Button, Dialog, DialogActions, DialogTitle, DialogContent } from "@mui/material";

type DeleteComplectDialogType = {
  onAccept: () => void;
  open: boolean;
  setOpen: (value: boolean) => void;
};

export function DeleteComplectDialog({ onAccept, open, setOpen }: DeleteComplectDialogType) {
  return (
    <Dialog open={open} onClose={() => setOpen(false)}>
      <DialogTitle>Подтверждение</DialogTitle>
      <DialogContent>Вы уверены, что хотите удалить выбранные комплекты?</DialogContent>
      <DialogActions>
        <Button size="small" variant="contained" onClick={() => setOpen(false)}>
          Отмена
        </Button>
        <Button size="small" variant="contained" color="error" onClick={onAccept}>
          Удалить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
