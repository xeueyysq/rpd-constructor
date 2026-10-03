import { Typography } from "@mui/material";
import { useStore } from "@shared/hooks";
import { formatEdit, latestEdit } from "../lib/fieldEdits";
import type { FieldEdits } from "../model/fieldEdits";

export function FieldEditLabel({ fields }: { fields: string[] }) {
  const edits = useStore((state) => state.jsonData.field_edits) as
    FieldEdits | undefined;
  const edit = latestEdit(edits ?? {}, fields);
  return edit ? (
    <Typography variant="caption" sx={{ color: "text.secondary" }}>
      Изменено: {formatEdit(edit)}
    </Typography>
  ) : null;
}
