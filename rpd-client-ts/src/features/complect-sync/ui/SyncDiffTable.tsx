import {
  Box,
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  formatFieldChangeLine,
  getFieldLabel,
} from "@shared/lib/formatFieldChange";
import type {
  SyncDiff,
  SyncDisciplineIncoming,
  SyncFieldChange,
} from "../model/types";

type FieldSelectionState = Record<string, Record<string, boolean>>;

type SyncDiffTableProps = {
  diff: SyncDiff;
  fieldSelection: FieldSelectionState;
  onFieldSelectionChange: (next: FieldSelectionState) => void;
  rowSelection: Record<string, boolean>;
  onRowSelectionChange: (next: Record<string, boolean>) => void;
};

const rowKey = (prefix: string, id: string | number) => `${prefix}:${id}`;

const DisciplineTitle = ({
  incoming,
  fallback,
}: {
  incoming?: SyncDisciplineIncoming;
  fallback?: string;
}) => (
  <Typography fontWeight={600}>
    {incoming?.discipline ?? fallback ?? "—"}
  </Typography>
);

const FieldRows = ({
  rowId,
  fields,
  fieldSelection,
  onFieldSelectionChange,
  disabled,
}: {
  rowId: string;
  fields: SyncFieldChange[];
  fieldSelection: FieldSelectionState;
  onFieldSelectionChange: (next: FieldSelectionState) => void;
  disabled?: boolean;
}) => (
  <>
    {fields.map((change) => {
      const checked = fieldSelection[rowId]?.[change.field] ?? true;
      return (
        <TableRow key={`${rowId}-${change.field}`}>
          <TableCell padding="checkbox">
            <Checkbox
              checked={checked}
              disabled={disabled}
              onChange={(_, value) =>
                onFieldSelectionChange({
                  ...fieldSelection,
                  [rowId]: {
                    ...fieldSelection[rowId],
                    [change.field]: value,
                  },
                })
              }
            />
          </TableCell>
          <TableCell>{getFieldLabel(change.field)}</TableCell>
          <TableCell>
            {formatFieldChangeLine(change.field, change.old, change.new)}
          </TableCell>
        </TableRow>
      );
    })}
  </>
);

export function SyncDiffTable({
  diff,
  fieldSelection,
  onFieldSelectionChange,
  rowSelection,
  onRowSelectionChange,
}: SyncDiffTableProps) {
  const hasChanges =
    diff.new.length > 0 || diff.updated.length > 0 || diff.removed.length > 0;

  if (!hasChanges) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        Изменений не обнаружено
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 420, overflow: "auto" }}>
      {diff.new.map((item) => {
        const id = rowKey("new", item.key);
        const selected = rowSelection[id] ?? true;
        return (
          <Box key={id} sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selected}
                  onChange={(_, value) =>
                    onRowSelectionChange({ ...rowSelection, [id]: value })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" color="success.main">
                    Новая дисциплина
                  </Typography>
                  <DisciplineTitle incoming={item.incoming} />
                </Box>
              }
            />
            {selected ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Поле</TableCell>
                    <TableCell>Значение</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <FieldRows
                    rowId={id}
                    fields={item.fields}
                    fieldSelection={fieldSelection}
                    onFieldSelectionChange={onFieldSelectionChange}
                  />
                </TableBody>
              </Table>
            ) : null}
          </Box>
        );
      })}

      {diff.updated.map((item) => {
        const id = rowKey("updated", item.id_1c);
        const selected = rowSelection[id] ?? true;
        return (
          <Box key={id} sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selected}
                  onChange={(_, value) =>
                    onRowSelectionChange({ ...rowSelection, [id]: value })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" color="warning.main">
                    Обновлена
                  </Typography>
                  <DisciplineTitle
                    incoming={item.incoming}
                    fallback={item.local.discipline}
                  />
                </Box>
              }
            />
            {selected ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Поле</TableCell>
                    <TableCell>Изменение</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <FieldRows
                    rowId={id}
                    fields={item.fields}
                    fieldSelection={fieldSelection}
                    onFieldSelectionChange={onFieldSelectionChange}
                  />
                </TableBody>
              </Table>
            ) : null}
          </Box>
        );
      })}

      {diff.removed.map((item) => {
        const id = rowKey("removed", item.id_1c);
        const selected = rowSelection[id] ?? true;
        return (
          <Box key={id} sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selected}
                  onChange={(_, value) =>
                    onRowSelectionChange({ ...rowSelection, [id]: value })
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" color="error.main">
                    Удалена из плана
                  </Typography>
                  <DisciplineTitle fallback={item.local.discipline} />
                </Box>
              }
            />
          </Box>
        );
      })}
    </Box>
  );
}
