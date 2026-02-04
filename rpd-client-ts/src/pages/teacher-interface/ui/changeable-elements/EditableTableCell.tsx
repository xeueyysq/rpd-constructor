import { TableCell, TextField } from "@mui/material";

interface IEditableTableCell {
  value: number | null;
  onValueChange: (value: number) => void;
  readOnly: boolean;
}

export function EditableTableCell({ value: fieldValue, onValueChange, readOnly }: IEditableTableCell) {
  if (readOnly)
    return (
      <TableCell
        style={{
          alignContent: "center",
          textAlign: "center",
          padding: 0,
        }}
      >
        {fieldValue}
      </TableCell>
    );

  return (
    <TableCell
      style={{
        alignContent: "center",
        textAlign: "center",
        padding: 0,
      }}
    >
      <TextField
        type="number"
        slotProps={{
          input: {
            inputProps: {
              min: 0,
            },
          },
        }}
        onFocus={(e) => e.target.select()}
        fullWidth
        autoFocus
        sx={{
          fontSize: "14px !important",
          "& .MuiInputBase-input": { fontSize: "14px !important", textAlign: "center" },
          flex: 1,
          "& .MuiInputBase-root": { alignItems: "flex-start", borderRadius: 0 },
          "& .MuiOutlinedInput-root": {
            borderRadius: 0,
            "& fieldset": { border: "none" },
            padding: 0,
          },
          "& textarea": { boxSizing: "border-box", resize: "none", overflow: "hidden" },
        }}
        value={fieldValue}
        onChange={(e) => onValueChange(Number(e.target.value))}
      />
    </TableCell>
  );
}
