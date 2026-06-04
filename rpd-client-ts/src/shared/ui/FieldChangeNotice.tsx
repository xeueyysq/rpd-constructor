import { Alert, Button } from "@mui/material";
import { formatFieldChangeLine } from "@shared/lib/formatFieldChange";
import type { TemplateFieldChange } from "@shared/types/templateFieldChange";

type FieldChangeNoticeProps = {
  fieldKey: string;
  changes: TemplateFieldChange[];
  onAcknowledge: (changeIds: number[]) => void | Promise<void>;
  isAcknowledging?: boolean;
};

export function FieldChangeNotice({
  fieldKey,
  changes,
  onAcknowledge,
  isAcknowledging,
}: FieldChangeNoticeProps) {
  const relevant = changes.filter((change) => change.field_key === fieldKey);
  if (!relevant.length) return null;

  const changeIds = relevant.map((change) => change.id);

  return (
    <Alert
      severity="info"
      sx={{ mb: 2 }}
      action={
        <Button
          color="inherit"
          size="small"
          disabled={isAcknowledging}
          onClick={() => onAcknowledge(changeIds)}
        >
          Понятно
        </Button>
      }
    >
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
