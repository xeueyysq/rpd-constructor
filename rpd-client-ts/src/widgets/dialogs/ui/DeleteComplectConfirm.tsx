import { Button, Dialog, DialogActions, DialogTitle, DialogContent } from "@mui/material";
import { useState } from "react";

type DeleteComplectDialogType = {
  onAccept: () => void;
  open: boolean;
};

export function DeleteComplectDialog({ onAccept, open }: DeleteComplectDialogType) {
  const [isOpen, setIsOpen] = useState<boolean>(open);
  return (
    <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
      <DialogTitle>Подтверждение</DialogTitle>
      <DialogContent>Вы уверены, что хотите удалить выбранные комплекты?</DialogContent>
      <DialogActions>
        <Button size="small" variant="contained" onClick={() => setIsOpen(false)}>
          Отмена
        </Button>
        <Button size="small" variant="contained" color="error" onClick={onAccept}>
          Удалить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
