import { Box, TableCell, TableRow, TextField } from "@mui/material";
import { EditableTableCell } from "../../EditableTableCell";
import {
  ATTESTATION_ROW_ID,
  DisciplineContentRow,
  EditableRowKey,
} from "../types";
import { getRowHours } from "../utils";

type DisciplineContentDataRowProps = {
  rowId: string;
  row: DisciplineContentRow;
  readOnly: boolean;
  attestationTheme: string;
  onValueChange: (
    rowId: string,
    key: EditableRowKey,
    value: string | number | null
  ) => void;
};

export function DisciplineContentDataRow({
  rowId,
  row,
  readOnly,
  attestationTheme,
  onValueChange,
}: DisciplineContentDataRowProps) {
  const rowHours = getRowHours(row);

  return (
    <TableRow key={rowId}>
      <TableCell
        padding="none"
        sx={{
          "& .MuiTableCell-root": {
            padding: "0px 0px",
          },
        }}
      >
        {rowId === ATTESTATION_ROW_ID ? (
          <Box sx={{ fontSize: 14, p: 1, fontWeight: 600 }}>
            {attestationTheme}
          </Box>
        ) : readOnly ? (
          row.theme
        ) : (
          <TextField
            sx={{
              fontSize: "14px !important",
              "& .MuiInputBase-input": {
                fontSize: "14px !important",
              },
              "& .MuiOutlinedInput-root": {
                borderRadius: 0,
                "& fieldset": { border: "none" },
                padding: 0,
              },
            }}
            multiline
            value={row.theme}
            onChange={(e) => onValueChange(rowId, "theme", e.target.value)}
            disabled={readOnly}
            fullWidth
          />
        )}
      </TableCell>
      <TableCell
        style={{
          alignContent: "center",
          textAlign: "center",
        }}
      >
        {rowHours.total}
      </TableCell>
      <EditableTableCell
        value={row.lectures}
        onValueChange={(value) => onValueChange(rowId, "lectures", value)}
        readOnly={readOnly}
      />
      <EditableTableCell
        value={row.seminars}
        onValueChange={(value) => onValueChange(rowId, "seminars", value)}
        readOnly={readOnly}
      />
      <EditableTableCell
        value={row.control ?? null}
        onValueChange={(value) => onValueChange(rowId, "control", value)}
        readOnly={readOnly}
      />
      <TableCell
        style={{
          alignContent: "center",
          textAlign: "center",
        }}
      >
        {rowHours.contact}
      </TableCell>
      <EditableTableCell
        value={row.independent_work}
        onValueChange={(value) =>
          onValueChange(rowId, "independent_work", value)
        }
        readOnly={readOnly}
      />
    </TableRow>
  );
}
