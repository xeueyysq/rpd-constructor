import { Box, Typography } from "@mui/material";
import { useStore } from "@shared/hooks";
import { formatEdit, latestEdit } from "../lib/fieldEdits";
import type { FieldEdits, TemplatePresenceResponse } from "../model/fieldEdits";
import { useTemplateSync } from "../model/templateSync";

export function TemplateCollabBar({
  presence,
}: {
  presence?: TemplatePresenceResponse;
}) {
  const edits = useStore((state) => state.jsonData.field_edits) as
    FieldEdits | undefined;
  const pending = useTemplateSync((state) => state.pending);
  const savedAt = useTemplateSync((state) => state.savedAt);
  const hasUnsavedChanges = useTemplateSync(
    (state) => Object.keys(state.dirty).length > 0
  );
  const latest = latestEdit(edits ?? {});

  return (
    <Box
      role="status"
      aria-label="Сохранение и присутствие"
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        px: 2,
        py: 1,
        color: "text.secondary",
        overflowWrap: "anywhere",
        maxHeight: theme.spacing(16),
        overflowY: "auto",
      })}
    >
      {pending ? (
        <Typography variant="caption">Сохранение…</Typography>
      ) : hasUnsavedChanges ? (
        <Typography variant="caption">Есть несохранённые изменения</Typography>
      ) : savedAt ? (
        <Typography variant="caption">
          Сохранено в{" "}
          {new Date(savedAt).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Typography>
      ) : null}
      {latest ? (
        <Typography variant="caption">
          Изменено: {formatEdit(latest)}
        </Typography>
      ) : null}
      {presence?.editors.length ? (
        <Typography variant="caption">
          Сейчас в шаблоне:{" "}
          {presence.editors.map((editor) => editor.fullname).join(", ")}
        </Typography>
      ) : null}
    </Box>
  );
}
