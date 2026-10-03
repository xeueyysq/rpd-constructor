import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  formatFieldChangeCell,
  getFieldLabel,
} from "@shared/lib/formatFieldChange";
import { StatusWithDate } from "@shared/ui";
import { useState } from "react";
import { useExchangeChanges } from "../api/queries";

const cellSx = { overflowWrap: "anywhere" } as const;

export function ExchangeChanges({
  exchangeId,
  latestChanges,
}: {
  exchangeId: number;
  latestChanges: { count: number; lastAppliedAt: string | null };
}) {
  const [open, setOpen] = useState(false);
  const {
    data: changes = [],
    isPending,
    isError,
  } = useExchangeChanges(exchangeId, open);
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
          {isPending ? <Typography>Загрузка…</Typography> : null}
          {isError ? (
            <Alert severity="error">Не удалось загрузить изменения из 1С</Alert>
          ) : null}
          {!isPending && !isError && !changes.length ? (
            <Typography sx={{ color: "text.secondary" }}>
              Изменений нет
            </Typography>
          ) : null}
          {changes.length ? (
            <Table size="small" sx={{ tableLayout: "fixed" }}>
              <TableHead>
                <TableRow>
                  {["Поле", "Было", "Стало"].map((title) => (
                    <TableCell
                      key={title}
                      sx={{ fontWeight: 600, bgcolor: "grey.100" }}
                    >
                      {title}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {changes.map((change) => (
                  <TableRow key={change.id}>
                    <TableCell sx={cellSx}>
                      {getFieldLabel(change.field_key)}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {formatFieldChangeCell(
                        change.field_key,
                        change.old_value
                      )}
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {formatFieldChangeCell(
                        change.field_key,
                        change.new_value
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
