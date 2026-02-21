import CachedIcon from "@mui/icons-material/Cached";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveAsIcon from "@mui/icons-material/SaveAs";
import { WarningDeleteDialog } from "@widgets/dialogs/ui";
import { Box, Button } from "@mui/material";
import { useState } from "react";
import { useDeleteRpdComplectsMutation } from "@entities/rpd-complect/model/queries";
import { ComplectData } from "@shared/types";
import { MRT_TableInstance } from "material-react-table";

interface IComplectTableHeader {
  setRowSelection?: (value: Record<string, boolean>) => void;
  table?: MRT_TableInstance<ComplectData>;
  id?: number;
  onAfterDelete?: () => void;
}

export function ComplectTableHeader({
  table,
  setRowSelection,
  id,
  onAfterDelete,
}: IComplectTableHeader) {
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);
  const deleteMutation = useDeleteRpdComplectsMutation();

  const isPageMode = id != null;
  const selectedRowsCount = table ? table.getSelectedRowModel().rows.length : 0;
  const hasSelection = isPageMode || selectedRowsCount > 0;

  const handleConfirmDeletion = async () => {
    const ids = table
      ? table.getSelectedRowModel().rows.map((r) => r.original.id)
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
      <WarningDeleteDialog
        open={openDeleteConfirm}
        setOpen={setOpenDeleteConfirm}
        onAccept={handleConfirmDeletion}
        description={
          isPageMode
            ? "Вы уверены, что хотите удалить комплект?"
            : "Вы уверены, что хотите удалить выбранные комплекты?"
        }
      />
    </Box>
  );
}
