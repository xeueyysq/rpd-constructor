import {
  useSetTemplateParticipants,
  useTemplateWorkflow,
  templateImportError,
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
  Divider,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { useId, useState, type ReactNode } from "react";
import type { TeacherHint } from "../lib/orderTeacherOptions";
import {
  assignmentsDisabled,
  prepareTeacherOptions,
  type TeacherOption,
} from "../lib/teacherSelection";

interface SectionProps {
  title: string;
  options: TeacherOption[];
  disabled: boolean;
  onChange: (userId: number, checked: boolean) => void;
  children: ReactNode;
}

function TeacherSection({
  title,
  options,
  disabled,
  onChange,
  children,
}: SectionProps) {
  return (
    <Box component="section" sx={{ mt: 2 }}>
      <Typography component="h3" variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {options.length ? (
        <Box
          component="ul"
          sx={{ listStyle: "none", m: 0, p: 0 }}
          aria-label={title}
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
                    onChange={(_, checked) => onChange(option.id, checked)}
                  />
                }
                label={`${option.fullname}${option.isActive ? "" : " (неактивен)"}`}
              />
            </Box>
          ))}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}

interface Props {
  discipline: string;
  templateId: number;
  status: string;
  participants: TemplateParticipant[];
  hints: TeacherHint[];
  canEditTeachers: boolean;
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
  onRefresh,
  onClose,
}: Props) {
  const titleId = useId();
  const { data: users = [], isPending, isError } = useAssignableTeachers();
  const workflow = useSetTemplateParticipants();
  const snapshot = useTemplateWorkflow(templateId);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseTeacherIds, setBaseTeacherIds] = useState(() =>
    participants.map((participant) => participant.userId)
  );
  const [valueIds, setValueIds] = useState(baseTeacherIds);
  const [currentParticipants, setCurrentParticipants] = useState(participants);
  const [restrictions, setRestrictions] = useState({ status, canEditTeachers });
  const { from1c, others, unmatchedNames } = prepareTeacherOptions(
    users,
    currentParticipants,
    valueIds,
    hints,
    search
  );
  const disabled =
    busy ||
    assignmentsDisabled(restrictions.status, restrictions.canEditTeachers);

  const handleChange = (userId: number, checked: boolean) => {
    if (disabled) return;
    setValueIds((previous) =>
      checked
        ? [...new Set([...previous, userId])]
        : previous.filter((id) => id !== userId)
    );
  };

  const apply = async () => {
    if (disabled) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await workflow.mutateAsync({
        templateId,
        teacherIds: valueIds,
        baseTeacherIds,
      });
      setBaseTeacherIds(
        saved.participants.map((participant) => participant.userId)
      );
      setCurrentParticipants(saved.participants);
      setRestrictions({
        status: saved.status,
        canEditTeachers: saved.canEditTeachers,
      });
      await onRefresh();
      onClose();
    } catch (error) {
      setError(templateImportError(error));
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    const result = await snapshot.refetch();
    if (!result.data || result.isError) {
      setError("Не удалось обновить состав преподавателей");
      return;
    }
    const current = result.data;
    const ids = current.participants.map((participant) => participant.userId);
    setCurrentParticipants(current.participants);
    setBaseTeacherIds(ids);
    setValueIds(ids);
    setRestrictions({
      status: current.status,
      canEditTeachers: current.canEditTeachers,
    });
    setError(null);
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
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                disabled={busy || snapshot.isFetching}
                onClick={() => void reload()}
              >
                Обновить состав
              </Button>
            }
          >
            {error} Обновление сбросит локальный выбор.
          </Alert>
        )}
        {restrictions.status === "ready" ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Чтобы изменить состав, верните РПД на доработку
          </Alert>
        ) : !restrictions.canEditTeachers ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Изменение состава преподавателей недоступно
          </Alert>
        ) : null}
        <TextField
          fullWidth
          label="Поиск преподавателя"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {isPending ? (
          <Typography sx={{ color: "text.secondary", mt: 2 }}>
            Загрузка преподавателей…
          </Typography>
        ) : isError ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            Не удалось загрузить преподавателей
          </Alert>
        ) : (
          <>
            <TeacherSection
              title="Из 1С"
              options={from1c}
              disabled={disabled}
              onChange={(userId, checked) => void handleChange(userId, checked)}
            >
              {!hints.length ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  В 1С преподаватели не указаны
                </Typography>
              ) : !from1c.length && !unmatchedNames.length ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Не найдено
                </Typography>
              ) : null}
              {unmatchedNames.length > 0 && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Аккаунты не найдены: {unmatchedNames.join(", ")}
                </Typography>
              )}
            </TeacherSection>
            <Divider sx={{ mt: 2 }} />
            <TeacherSection
              title="Из системы"
              options={others}
              disabled={disabled}
              onChange={(userId, checked) => void handleChange(userId, checked)}
            >
              {!others.length ? (
                <Typography sx={{ color: "text.secondary" }}>
                  Не найдено
                </Typography>
              ) : null}
            </TeacherSection>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Отмена
        </Button>
        <Button
          variant="contained"
          disabled={disabled}
          onClick={() => void apply()}
        >
          Применить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
