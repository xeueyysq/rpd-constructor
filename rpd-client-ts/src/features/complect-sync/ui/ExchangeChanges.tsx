import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { formatFieldChangeLine } from "@shared/lib/formatFieldChange";
import { showErrorMessage } from "@shared/lib";
import { StatusWithDate } from "@shared/ui";
import { useState } from "react";
import {
  useAcknowledgeExchangeChanges,
  useExchangeChanges,
} from "../api/queries";

export function ExchangeChanges({
  exchangeId,
  pendingChanges,
  onAcknowledged,
}: {
  exchangeId: number;
  pendingChanges: { count: number; lastAppliedAt: string | null };
  onAcknowledged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { data: changes = [] } = useExchangeChanges(exchangeId, open);
  const mutation = useAcknowledgeExchangeChanges();
  const acknowledge = async () => {
    try {
      await mutation.mutateAsync(exchangeId);
      setOpen(false);
      await onAcknowledged();
    } catch (error) {
      console.error(error);
      showErrorMessage("Не удалось подтвердить изменения 1С");
    }
  };
  if (!pendingChanges.count) return null;
  return (
    <>
      <Button
        size="small"
        onClick={() => setOpen(true)}
        aria-label={`Изменения 1С: строка ${exchangeId}`}
      >
        <StatusWithDate
          label="Обновлено из 1С"
          date={pendingChanges.lastAppliedAt ?? undefined}
        />
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Изменения из 1С</DialogTitle>
        <DialogContent>
          {changes.map((change) => (
            <Box key={change.id} sx={{ py: 1 }}>
              {formatFieldChangeLine(
                change.field_key,
                change.old_value,
                change.new_value
              )}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Закрыть</Button>
          <Button
            variant="contained"
            disabled={mutation.isPending}
            onClick={() => void acknowledge()}
          >
            Просмотрено
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
