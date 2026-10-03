import { Box, TableCell, TableRow, TextField } from "@mui/material";
import { EditableTableCell } from "../../EditableTableCell";
import { DisciplineContentRow, EditableRowKey } from "../types";
import { ATTESTATION_ROW_ID } from "@pages/teacher-interface/model/useDisciplineContentData";
import { getRowHours } from "@pages/teacher-interface/lib/hours";

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
  onBlur: () => void;
};

export function DisciplineContentDataRow({
  rowId,
  row,
  readOnly,
  attestationTheme,
  onValueChange,
  onBlur,
}: DisciplineContentDataRowProps) {
  const rowHours = getRowHours(row);

  return (
    <TableRow key={rowId}>
      <TableCell>
        {rowId === ATTESTATION_ROW_ID ? (
          <Box sx={{ fontSize: 14, fontWeight: 600 }}>{attestationTheme}</Box>
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
            onBlur={onBlur}
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
        {rowHours.all}
      </TableCell>
      <EditableTableCell
        value={row.lectures}
        onValueChange={(value) => onValueChange(rowId, "lectures", value)}
        onBlur={onBlur}
        readOnly={readOnly}
      />
      <EditableTableCell
        value={row.seminars}
        onValueChange={(value) => onValueChange(rowId, "seminars", value)}
        onBlur={onBlur}
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
        onBlur={onBlur}
        readOnly={readOnly}
      />
      <EditableTableCell
        value={row.control ?? null}
        onValueChange={(value) => onValueChange(rowId, "control", value)}
        onBlur={onBlur}
        readOnly={readOnly || rowId !== ATTESTATION_ROW_ID}
      />
    </TableRow>
  );
}
