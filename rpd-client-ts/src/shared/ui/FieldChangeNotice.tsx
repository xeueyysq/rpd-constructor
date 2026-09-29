import { Alert } from "@mui/material";
import { formatFieldChangeLine } from "@shared/lib/formatFieldChange";
import type { TemplateFieldChange } from "@shared/types/templateFieldChange";

type FieldChangeNoticeProps = {
  fieldKey: string;
  changes: TemplateFieldChange[];
};

export function FieldChangeNotice({
  fieldKey,
  changes,
}: FieldChangeNoticeProps) {
  const relevant = changes.filter((change) => change.field_key === fieldKey);
  if (!relevant.length) return null;
  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      {relevant.map((change) => (
        <div key={change.id}>
          Изменено с учебного плана:{" "}
          {formatFieldChangeLine(
            change.field_key,
            change.old_value,
            change.new_value
          )}
        </div>
      ))}
    </Alert>
  );
}
