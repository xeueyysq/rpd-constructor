import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { ConfirmActionDialog } from "@shared/ui";
import { SyncDiffTable } from "./SyncDiffTable";
import type {
  SyncApplySelection,
  SyncDiff,
  SyncPreviewResponse,
} from "../model/types";
import { useSyncPreviewMutation } from "../model/useSyncPreview";
import { useSyncApplyMutation } from "../model/useSyncApply";

type UpdateComplectDialogProps = {
  open: boolean;
  complectUuid: string | null;
  onClose: () => void;
  onApplied?: () => void;
};

const buildDefaultFieldSelection = (diff: SyncDiff) => {
  const state: Record<string, Record<string, boolean>> = {};
  for (const item of diff.new) {
    const rowId = `new:${item.key}`;
    state[rowId] = Object.fromEntries(
      item.fields.map((field) => [field.field, true])
    );
  }
  for (const item of diff.updated) {
    const rowId = `updated:${item.id_1c}`;
    state[rowId] = Object.fromEntries(
      item.fields.map((field) => [field.field, true])
    );
  }
  return state;
};

const buildDefaultRowSelection = (diff: SyncDiff) => {
  const state: Record<string, boolean> = {};
  for (const item of diff.new) state[`new:${item.key}`] = true;
  for (const item of diff.updated) state[`updated:${item.id_1c}`] = true;
  for (const item of diff.removed) state[`removed:${item.id_1c}`] = true;
  return state;
};

const buildSelections = (
  preview: SyncPreviewResponse,
  rowSelection: Record<string, boolean>,
  fieldSelection: Record<string, Record<string, boolean>>
): SyncApplySelection[] => {
  const selections: SyncApplySelection[] = [];

  for (const item of preview.diff.new) {
    const rowId = `new:${item.key}`;
    if (!rowSelection[rowId]) continue;
    const fields = item.fields
      .filter((field) => fieldSelection[rowId]?.[field.field] !== false)
      .map((field) => field.field);
    if (!fields.length) continue;
    selections.push({
      action: "add",
      incoming: item.incoming,
      fields,
    });
  }

  for (const item of preview.diff.updated) {
    const rowId = `updated:${item.id_1c}`;
    if (!rowSelection[rowId]) continue;
    const fields = item.fields
      .filter((field) => fieldSelection[rowId]?.[field.field] !== false)
      .map((field) => field.field);
    if (!fields.length) continue;
    selections.push({
      action: "update",
      id_1c: item.id_1c,
      incoming: item.incoming,
      fields,
    });
  }

  for (const item of preview.diff.removed) {
    const rowId = `removed:${item.id_1c}`;
    if (!rowSelection[rowId]) continue;
    selections.push({ action: "remove", id_1c: item.id_1c });
  }

  return selections;
};

export function UpdateComplectDialog({
  open,
  complectUuid,
  onClose,
  onApplied,
}: UpdateComplectDialogProps) {
  const queryClient = useQueryClient();
  const previewMutation = useSyncPreviewMutation();
  const applyMutation = useSyncApplyMutation();
  const [preview, setPreview] = useState<SyncPreviewResponse | null>(null);
  const [fieldSelection, setFieldSelection] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [openApplyConfirm, setOpenApplyConfirm] = useState(false);

  const resetState = useCallback(() => {
    setPreview(null);
    setFieldSelection({});
    setRowSelection({});
    setOpenApplyConfirm(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const applyPreview = (data: SyncPreviewResponse) => {
    setPreview(data);
    setFieldSelection(buildDefaultFieldSelection(data.diff));
    setRowSelection(buildDefaultRowSelection(data.diff));
  };

  const handleLoadFrom1c = async () => {
    if (!complectUuid) return;
    try {
      const data = await previewMutation.mutateAsync(complectUuid);
      applyPreview(data);
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось загрузить данные из 1С");
    }
  };

  const selections = useMemo(
    () =>
      preview ? buildSelections(preview, rowSelection, fieldSelection) : [],
    [preview, rowSelection, fieldSelection]
  );

  const handleApplyClick = () => {
    if (!complectUuid || !preview) return;
    if (!selections.length) {
      showErrorMessage("Выберите хотя бы одно изменение");
      return;
    }
    setOpenApplyConfirm(true);
  };

  const handleApply = async () => {
    if (!complectUuid || !preview || !selections.length) return;
    setOpenApplyConfirm(false);
    try {
      await applyMutation.mutateAsync({
        complectId: complectUuid,
        selections,
      });
      await queryClient.invalidateQueries({ queryKey: ["rpd-complects"] });
      showSuccessMessage("Изменения применены");
      onApplied?.();
      handleClose();
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось применить изменения");
    }
  };

  const isLoading = previewMutation.isPending || applyMutation.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Обновление комплекта из 1С</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Загрузите актуальный учебный план из 1С и выберите изменения для
          применения
        </Typography>
        <Button
          variant="contained"
          onClick={handleLoadFrom1c}
          disabled={!complectUuid || isLoading}
        >
          Загрузить из 1С
        </Button>

        {isLoading && !preview ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : null}

        {preview ? (
          <Box sx={{ mt: 3 }}>
            <SyncDiffTable
              diff={preview.diff}
              fieldSelection={fieldSelection}
              onFieldSelectionChange={setFieldSelection}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </Box>
        ) : null}

        {!complectUuid ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            Выберите один комплект для обновления
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Отмена</Button>
        <Button
          variant="contained"
          onClick={handleApplyClick}
          disabled={!preview || !selections.length || isLoading}
        >
          Применить выбранное
        </Button>
      </DialogActions>
      <ConfirmActionDialog
        open={openApplyConfirm}
        title="Подтвердите обновление"
        description={`Выбранные изменения (${selections.length}) будут применены к комплекту. Часть текущих данных может быть перезаписана. Продолжить?`}
        confirmText="Применить"
        confirmColor="warning"
        onConfirm={handleApply}
        onClose={() => setOpenApplyConfirm(false)}
      />
    </Dialog>
  );
}
