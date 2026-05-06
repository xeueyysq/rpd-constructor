import CachedIcon from "@mui/icons-material/Cached";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveAsIcon from "@mui/icons-material/SaveAs";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useState } from "react";
import { useDeleteRpdComplectsMutation } from "@entities/rpd-complect/model/queries";
import { ComplectData } from "@shared/types";
import { MRT_TableInstance } from "material-react-table";

interface IComplectTableHeader {
  setRowSelection?: (value: Record<string, boolean>) => void;
  table?: MRT_TableInstance<ComplectData>;
  id?: string;
  onAfterDelete?: () => void;
  onBuildFundsClick?: () => void;
}

export function ComplectTableHeader({
  table,
  setRowSelection,
  id,
  onAfterDelete,
  onBuildFundsClick,
}: IComplectTableHeader) {
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);
  const deleteMutation = useDeleteRpdComplectsMutation();

  const isPageMode = id != null;
  const selectedRowsCount = table ? table.getSelectedRowModel().rows.length : 0;
  const hasSelection = isPageMode || selectedRowsCount > 0;

  const handleConfirmDeletion = async () => {
    const ids = table
      ? table.getSelectedRowModel().rows.map((r) => r.original.uuid)
      : id != null
        ? [id]
        : [];
    setOpenDeleteConfirm(false);
    if (setRowSelection) setRowSelection({});
    await deleteMutation.mutateAsync(ids);
    onAfterDelete?.();
  };

  return (
    <Box
      sx={{
        display: "flex",
        px: 1.5,
        pt: 0.5,
        gap: "12px",
      }}
    >
      <Button
        variant="outlined"
        startIcon={<CachedIcon />}
        disabled={!hasSelection}
        sx={{ alignSelf: "flex-start" }}
      >
        Обновить комплект
      </Button>
      <Button
        variant="outlined"
        startIcon={<DeleteIcon />}
        disabled={!hasSelection}
        color="error"
        onClick={() => setOpenDeleteConfirm(true)}
      >
        Удалить
      </Button>
      <Button
        variant="outlined"
        startIcon={<SaveAsIcon />}
        disabled={!hasSelection}
      >
        Добавить содержание рпд
      </Button>
      <Button
        variant="contained"
        startIcon={<PlaylistAddCheckIcon />}
        disabled={!isPageMode || !onBuildFundsClick}
        onClick={onBuildFundsClick}
      >
        Собрать ФОСы
      </Button>
      <Dialog
        open={openDeleteConfirm}
        onClose={() => setOpenDeleteConfirm(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Подтвердите удаление</DialogTitle>
        <DialogContent>
          {isPageMode
            ? "Вы уверены, что хотите удалить комплект?"
            : "Вы уверены, что хотите удалить выбранные комплекты?"}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteConfirm(false)}>Отмена</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDeletion}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
