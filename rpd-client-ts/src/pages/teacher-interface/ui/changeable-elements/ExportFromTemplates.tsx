import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { Box, IconButton } from "@mui/material";
import { useState } from "react";
import { SourcePickerDialog } from "@features/template-import";
import type { ImportField } from "@entities/template";
import { useStore } from "@shared/hooks";

const fieldLabels: Record<ImportField, string> = {
  protocol: "Протокол",
  goals: "Цели и задачи",
  place_more_text: "Место дисциплины",
  content: "Содержание дисциплины",
  content_more_text: "Дополнительное содержание",
  content_template_more_text: "Шаблон содержания",
  methodological_support_template: "Методическое обеспечение",
  textbook: "Основная литература",
  additional_textbook: "Дополнительная литература",
  professional_information_resources: "Профессиональные ресурсы",
  software: "Программное обеспечение",
  logistics_template: "Материальное обеспечение",
};

export function ExportFromTemplates({
  elementName,
  setChangeableValue,
}: {
  elementName: string;
  setChangeableValue?: (value: unknown) => void;
}) {
  const jsonData = useStore((state) => state.jsonData);
  const [open, setOpen] = useState(false);
  const [baseAt, setBaseAt] = useState<string | null>(null);
  return (
    <Box>
      <IconButton
        aria-label="Импортировать поле"
        disabled={
          !jsonData.id ||
          ["ready", "closed"].includes(
            String(jsonData.current_status ?? jsonData.status ?? "")
          ) ||
          Boolean(jsonData.removed_at)
        }
        onClick={() => {
          setBaseAt(jsonData.field_edits?.[elementName]?.at ?? null);
          setOpen(true);
        }}
      >
        <MoreHorizIcon sx={{ color: "text.primary" }} />
      </IconButton>
      {open && (
        <SourcePickerDialog
          key={jsonData.id}
          open
          targetTemplateId={jsonData.id}
          targetLabel={`${jsonData.disciplins_name ?? "РПД"} • ${fieldLabels[elementName as ImportField] ?? "поле РПД"}`}
          field={elementName as ImportField}
          fieldLabel={fieldLabels[elementName as ImportField]}
          fieldBaseAt={baseAt}
          onFieldImported={setChangeableValue}
          onClose={() => setOpen(false)}
        />
      )}
    </Box>
  );
}
