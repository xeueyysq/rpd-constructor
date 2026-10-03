import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import { formatStatusDate } from "@shared/lib/formatStatusDate";
import type { HistoryEvent } from "../api/history";
import { getTemplateStatusLabel } from "../lib/getTemplateStatusLabel";

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

const eventTitle = (action?: string) =>
  actionLabels[action ?? ""] ?? action ?? "Изменение статуса";

export function TemplateHistoryDialog({
  history,
  open,
  isPending,
  isError,
  onClose,
}: {
  history: HistoryEvent[];
  open: boolean;
  isPending: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  // Новые события сверху; копия, чтобы не менять данные React Query.
  const events = [...history].reverse();
  return (
    <Dialog
      maxWidth="sm"
      fullWidth
      scroll="paper"
      open={open}
      onClose={onClose}
    >
      <DialogTitle>История шаблона</DialogTitle>
      <DialogContent dividers>
        {isPending ? <Typography>Загрузка истории…</Typography> : null}
        {isError ? (
          <Alert severity="error">Не удалось загрузить историю шаблона</Alert>
        ) : null}
        {!isPending && !isError && !events.length ? (
          <Typography color="text.secondary">История пуста</Typography>
        ) : null}
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {events.map((event, index) => (
            <Box component="li" key={`${event.date}-${index}`}>
              {index > 0 ? <Divider sx={{ my: 1.5 }} /> : null}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 2,
                }}
              >
                <Typography sx={{ fontWeight: 500 }}>
                  {eventTitle(event.action)}
                </Typography>
                <Typography
                  component="span"
                  sx={(theme) => ({
                    ...theme.typography.button,
                    color: "primary.main",
                    fontSize: theme.typography.pxToRem(13),
                    textAlign: "right",
                  })}
                >
                  {getTemplateStatusLabel(event.status)}
                </Typography>
              </Box>
              <Typography
                sx={(theme) => ({
                  color: "grey.600",
                  fontSize: theme.typography.pxToRem(12),
                })}
              >
                {[formatStatusDate(event.date), event.user]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
              {event.comment ? (
                <Box
                  sx={(theme) => ({
                    mt: 1,
                    px: 1.5,
                    py: 1,
                    bgcolor: "grey.100",
                    borderRadius: 1,
                    fontSize: theme.typography.pxToRem(14),
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  })}
                >
                  {event.comment}
                </Box>
              ) : null}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
