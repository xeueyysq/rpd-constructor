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
  const latest = latestEdit(edits ?? {});

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
      {presence?.editors.length ? (
        <Typography variant="body2">
          Сейчас в шаблоне:{" "}
          {presence.editors.map((editor) => editor.fullname).join(", ")}
        </Typography>
      ) : null}
      {pending ? (
        <Typography variant="body2">Сохранение…</Typography>
      ) : savedAt ? (
        <Typography variant="body2">
          Сохранено в{" "}
          {new Date(savedAt).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Typography>
      ) : null}
      {latest ? (
        <Typography variant="body2">Изменено: {formatEdit(latest)}</Typography>
      ) : null}
    </Box>
  );
}
