import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { formatFieldChangeLine } from "@shared/lib/formatFieldChange";
import { StatusWithDate } from "@shared/ui";
import { useState } from "react";
import { useExchangeChanges } from "../api/queries";

export function ExchangeChanges({
  exchangeId,
  latestChanges,
}: {
  exchangeId: number;
  latestChanges: { count: number; lastAppliedAt: string | null };
}) {
  const [open, setOpen] = useState(false);
  const { data: changes = [] } = useExchangeChanges(exchangeId, open);
  if (!latestChanges.count) return null;
  return (
    <>
      <StatusWithDate
        label="Обновлено из 1С"
        date={latestChanges.lastAppliedAt}
        onClick={() => setOpen(true)}
        ariaLabel={`Изменения 1С: строка ${exchangeId}`}
      />
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
        </DialogActions>
      </Dialog>
    </>
  );
}
