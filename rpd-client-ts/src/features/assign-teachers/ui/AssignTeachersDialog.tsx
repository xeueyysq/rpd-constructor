import {
  useWorkflowAction,
  type TemplateParticipant,
} from "@entities/template";
import { useAssignableTeachers } from "@entities/user";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { showErrorMessage } from "@shared/lib";
import { useId, useState } from "react";
import { diffAssignments } from "../lib/diffAssignments";
import type { TeacherHint } from "../lib/orderTeacherOptions";
import {
  assignmentsDisabled,
  prepareTeacherOptions,
} from "../lib/teacherSelection";

interface Props {
  discipline: string;
  templateId?: number | null;
  status: string;
  participants: TemplateParticipant[];
  hints: TeacherHint[];
  canEditTeachers: boolean;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export function AssignTeachersDialog({
  discipline,
  templateId,
  status,
  participants,
  hints,
  canEditTeachers,
  selectedIds,
  onSelectedIdsChange,
  onRefresh,
  onClose,
}: Props) {
  const titleId = useId();
  const { data: users = [], isPending, isError } = useAssignableTeachers();
  const workflow = useWorkflowAction();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const valueIds =
    templateId != null
      ? participants.map((participant) => participant.userId)
      : selectedIds;
  const { options, unmatchedNames } = prepareTeacherOptions(
    users,
    participants,
    valueIds,
    hints,
    search
  );
  const disabled = busy || assignmentsDisabled(status, canEditTeachers);

  const handleChange = async (userId: number, checked: boolean) => {
    if (disabled) return;
    const nextIds = checked
      ? [...valueIds, userId]
      : valueIds.filter((id) => id !== userId);
    if (templateId == null) {
      onSelectedIdsChange(nextIds);
      return;
    }
    const changes = diffAssignments(valueIds, nextIds);
    setBusy(true);
    try {
      for (const id of changes.unassign)
        await workflow.mutateAsync({
          templateId,
          action: "unassign",
          userId: id,
        });
      for (const id of changes.assign)
        await workflow.mutateAsync({
          templateId,
          action: "assign",
          userId: id,
        });
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось изменить состав преподавателей");
    } finally {
      try {
        await onRefresh();
      } catch (error) {
        console.error(error);
        showErrorMessage("Не удалось обновить состав преподавателей");
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id={titleId}>Преподаватели: {discipline}</DialogTitle>
      <DialogContent>
        {status === "ready" ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Чтобы изменить состав, верните РПД на доработку
          </Alert>
        ) : !canEditTeachers ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Изменение состава преподавателей недоступно
          </Alert>
        ) : null}
        <TextField
          fullWidth
          label="Поиск преподавателя"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ mt: 1 }}
        />
        <Box
          component="ul"
          sx={{ listStyle: "none", m: 0, p: 0, mt: 1 }}
          aria-label="Аккаунты преподавателей"
        >
          {options.map((option) => (
            <Box component="li" key={option.id}>
              <FormControlLabel
                sx={{
                  width: "100%",
                  m: 0,
                  alignItems: "flex-start",
                  "& .MuiFormControlLabel-label": {
                    py: 1,
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  },
                }}
                control={
                  <Checkbox
                    checked={option.selected}
                    disabled={
                      disabled || (!option.selected && !option.canAssign)
                    }
                    onChange={(_, checked) =>
                      void handleChange(option.id, checked)
                    }
                  />
                }
                label={`${option.fullname}${option.isActive ? "" : " (неактивен)"}${option.from1c ? " — из 1С" : ""}`}
              />
            </Box>
          ))}
        </Box>
        {isPending ? (
          <Typography color="text.secondary">
            Загрузка преподавателей…
          </Typography>
        ) : isError ? (
          <Alert severity="error">Не удалось загрузить преподавателей</Alert>
        ) : !options.length ? (
          <Typography color="text.secondary">
            Преподаватели не найдены
          </Typography>
        ) : null}
        {unmatchedNames.length ? (
          <Box sx={{ mt: 2 }}>
            {unmatchedNames.map((name) => (
              <Typography key={name} variant="body2" color="text.secondary">
                В 1С, аккаунт не найден: {name}
              </Typography>
            ))}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}
