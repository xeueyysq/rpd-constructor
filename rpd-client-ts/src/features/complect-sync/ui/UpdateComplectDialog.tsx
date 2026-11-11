import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { ConfirmActionDialog } from "@shared/ui";
import { SyncDiffTable } from "./SyncDiffTable";
import type {
  SyncApplySelection,
  SyncDiff,
  SyncPreviewResponse,
  TeacherImportResult,
} from "../model/types";
import { useSyncPreviewMutation } from "../model/useSyncPreview";
import { useSyncApplyMutation } from "../model/useSyncApply";

type UpdateComplectDialogProps = {
  open: boolean;
  complectUuid: string | null;
  onClose: () => void;
  onApplied?: () => void;
};

type DialogOpening = { complectUuid: string; generation: number };

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
  const generationRef = useRef(0);
  const openingRef = useRef<DialogOpening | null>(null);
  const [opening, setOpening] = useState<DialogOpening | null>(null);
  const [loadedPreview, setLoadedPreview] = useState<{
    opening: DialogOpening;
    data: SyncPreviewResponse;
  } | null>(null);
  const [loadingOpening, setLoadingOpening] = useState<DialogOpening | null>(
    null
  );
  const [fieldSelection, setFieldSelection] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [openApplyConfirm, setOpenApplyConfirm] = useState(false);
  const [importResult, setImportResult] = useState<TeacherImportResult | null>(
    null
  );

  const resetState = useCallback(() => {
    setLoadedPreview(null);
    setLoadingOpening(null);
    setFieldSelection({});
    setRowSelection({});
    setOpenApplyConfirm(false);
    setImportResult(null);
  }, []);

  // Инвалидируем открытие до отрисовки новой цели, включая закрытие извне.
  useLayoutEffect(() => {
    const current =
      open && complectUuid
        ? { complectUuid, generation: ++generationRef.current }
        : null;
    openingRef.current = current;
    setOpening(current);
    resetState();
    return () => {
      openingRef.current = null;
    };
  }, [open, complectUuid, resetState]);

  const preview =
    open &&
    opening?.complectUuid === complectUuid &&
    loadedPreview?.opening === opening
      ? loadedPreview.data
      : null;

  const handleClose = () => {
    openingRef.current = null;
    resetState();
    onClose();
  };

  const handleLoadFrom1c = async () => {
    const current = openingRef.current;
    if (!current || current.complectUuid !== complectUuid) return;
    setLoadingOpening(current);
    try {
      const data = await previewMutation.mutateAsync(current.complectUuid);
      if (openingRef.current !== current) return;
      setLoadedPreview({ opening: current, data });
      setImportResult(null);
      setFieldSelection(buildDefaultFieldSelection(data.diff));
      setRowSelection(buildDefaultRowSelection(data.diff));
    } catch (error) {
      if (openingRef.current !== current) return;
      console.error(error);
      showErrorMessage("Не удалось загрузить данные из 1С");
    } finally {
      if (openingRef.current === current) setLoadingOpening(null);
    }
  };

  const selections = useMemo(
    () =>
      preview ? buildSelections(preview, rowSelection, fieldSelection) : [],
    [preview, rowSelection, fieldSelection]
  );
  const canApply =
    !importResult &&
    (selections.length > 0 || Boolean(preview?.teacherImportManifest));

  const handleApplyClick = () => {
    if (!preview || openingRef.current !== loadedPreview?.opening) return;
    if (!canApply) {
      showErrorMessage("Выберите хотя бы одно изменение");
      return;
    }
    setOpenApplyConfirm(true);
  };

  const handleApply = async () => {
    const current = openingRef.current;
    if (!current || current !== loadedPreview?.opening || !preview || !canApply)
      return;
    setOpenApplyConfirm(false);
    setLoadingOpening(current);
    try {
      const result = await applyMutation.mutateAsync({
        complectId: current.complectUuid,
        selections,
        teacherImportManifest: preview.teacherImportManifest,
      });
      // Завершённый запрос обновляет свою цель даже после закрытия диалога.
      const targetIds = new Set([
        current.complectUuid,
        String(result.complectId),
      ]);
      if (preview.complect.uuid) targetIds.add(preview.complect.uuid);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rpd-complects"] }),
        queryClient.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "rpd-complect" &&
            targetIds.has(String(query.queryKey[1])),
        }),
        queryClient.invalidateQueries({ queryKey: ["exchange-changes"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["assignable-teachers"] }),
      ]);
      if (openingRef.current !== current) return;
      showSuccessMessage(
        result.teacherImport
          ? `Изменения применены. Добавлено преподавателей: ${result.teacherImport.created}`
          : "Изменения применены"
      );
      onApplied?.();
      if (result.teacherImport?.unresolved.length)
        setImportResult(result.teacherImport);
      else handleClose();
    } catch (error) {
      if (openingRef.current !== current) return;
      console.error(error);
      showErrorMessage("Не удалось применить изменения");
    } finally {
      if (openingRef.current === current) setLoadingOpening(null);
    }
  };

  const isLoading = opening !== null && loadingOpening === opening;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Обновление комплекта из 1С</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: "text.secondary", mb: 2 }}>
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
          <>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info" sx={{ mb: 2 }}>
              При применении преподаватели из полной нагрузки будут добавлены в
              список пользователей. Вход новым преподавателям настроит
              администратор.
            </Alert>
            {importResult?.unresolved.map((item) => (
              <Alert
                severity="warning"
                key={`${item.reason}:${item.name}`}
                sx={{ mb: 1 }}
              >
                {item.name}:{" "}
                {item.reason === "ambiguous"
                  ? "найдено несколько пользователей, сопоставление требует проверки"
                  : item.reason === "unavailable"
                    ? "существующего пользователя нельзя назначить: проверьте активность и роль"
                    : "недостаточно данных для создания карточки"}
                .
              </Alert>
            ))}
            <SyncDiffTable
              diff={preview.diff}
              fieldSelection={fieldSelection}
              onFieldSelectionChange={setFieldSelection}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
            />
          </>
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
          disabled={!preview || !canApply || isLoading}
        >
          Применить выбранное
        </Button>
      </DialogActions>
      <ConfirmActionDialog
        open={openApplyConfirm}
        title="Подтвердите обновление"
        description={`Выбранные изменения (${selections.length}) будут применены к комплекту; отсутствующие преподаватели нагрузки появятся в пользователях. Продолжить?`}
        confirmText="Применить"
        confirmColor="warning"
        onConfirm={handleApply}
        onClose={() => setOpenApplyConfirm(false)}
      />
    </Dialog>
  );
}
