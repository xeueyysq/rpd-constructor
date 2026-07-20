import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { FC, ReactNode } from "react";

export interface ConfirmActionDialogProps {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "primary" | "error" | "warning" | "success" | "info";
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmActionDialog: FC<ConfirmActionDialogProps> = ({
  open,
  title = "Подтвердите действие",
  description,
  confirmText = "Продолжить",
  cancelText = "Отмена",
  confirmColor = "primary",
  onConfirm,
  onClose,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    {description ? (
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
    ) : null}
    <DialogActions>
      <Button onClick={onClose}>{cancelText}</Button>
      <Button variant="contained" color={confirmColor} onClick={onConfirm}>
        {confirmText}
      </Button>
    </DialogActions>
  </Dialog>
);
