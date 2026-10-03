import { getTemplateStatusLabel, type HistoryEvent } from "@entities/template";
import {
  Alert,
  Box,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

const actionLabels: Record<string, string> = {
  assign: "Назначен преподаватель",
  unassign: "Преподаватель снят",
  start: "Взято в работу",
  finish: "Готово",
  reopen: "Отметка снята",
  accept: "Принято",
  refine: "Возвращено на доработку",
  create: "Создано",
  migration: "Перенесено",
  activation: "Изменена активность",
};

export default function HistoryModal({
  history,
  openDialog,
  isPending,
  isError,
  setOpenDialog,
}: {
  history: HistoryEvent[];
  openDialog: boolean;
  isPending: boolean;
  isError: boolean;
  setOpenDialog: (open: boolean) => void;
}) {
  return (
    <Dialog
      maxWidth="lg"
      fullWidth
      open={openDialog}
      onClose={() => setOpenDialog(false)}
    >
      <DialogTitle>История шаблона</DialogTitle>
      <DialogContent>
        {isPending ? <Typography>Загрузка истории…</Typography> : null}
        {isError ? (
          <Alert severity="error">Не удалось загрузить историю шаблона</Alert>
        ) : null}
        <Stack spacing={2}>
          {history.map((event, index) => (
            <Box key={`${event.date}-${index}`}>
              <Box>
                {format(parseISO(event.date), "d MMMM yyyy, HH:mm", {
                  locale: ru,
                })}{" "}
                — {event.user}
              </Box>
              <Box>
                {actionLabels[event.action ?? ""] ??
                  event.action ??
                  "Изменение статуса"}
                : {getTemplateStatusLabel(event.status)}
              </Box>
              {event.comment ? <Box>Комментарий: {event.comment}</Box> : null}
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenDialog(false)}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
