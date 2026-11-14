import { useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import {
  templateImportError,
  useWordImportApply,
  useWordImportPreview,
  type WordImportField,
  type WordImportPreview,
} from "@entities/template";
import { showSuccessMessage } from "@shared/lib";
import { CompactDialogTheme } from "@shared/ui";
import { FullFieldPreview } from "./FullFieldPreview";

type Props = {
  open: boolean;
  targetTemplateId: number;
  onClose: () => void;
  onImported?: () => Promise<void> | void;
  onChooseSource?: () => void;
};

const labels: Record<WordImportField, string> = {
  goals: "Цели и задачи",
  place_more_text: "Место дисциплины",
  content_more_text: "Содержание дисциплины",
  content_template_more_text: "Дополнительное содержание",
  methodological_support_template: "Методическое обеспечение",
  software: "Программное обеспечение",
  textbook: "Основная литература",
  additional_textbook: "Дополнительная литература",
  professional_information_resources: "Профессиональные ресурсы",
  content: "Темы и часы",
};

function friendlyWarning(warning: string) {
  if (
    /^(Содержание|Цели|Место|Методическое|Основная|Дополнительная|Профессиональные|Программное|Большой раздел|Компетенции)/.test(
      warning
    ) &&
    warning.length <= 220
  )
    return warning;
  const lower = warning.toLowerCase();
  if (/hour|час|нагруз/.test(lower))
    return "Часы и распределение нагрузки не удалось однозначно сопоставить. Проверьте их вручную.";
  if (/section|раздел|parse|found|not found|не найден/.test(lower))
    return "Часть разделов документа не распознана. Проверьте выбранные поля.";
  return "Часть данных документа не распознана. Проверьте результат перед импортом.";
}

export function WordImportDialog(props: Props) {
  return (
    <CompactDialogTheme>
      <WordImportSession {...props} />
    </CompactDialogTheme>
  );
}

function WordImportSession({
  open,
  targetTemplateId,
  onClose,
  onImported,
  onChooseSource,
}: Props) {
  const titleId = useId();
  const previewMutation = useWordImportPreview();
  const applyMutation = useWordImportApply();
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<WordImportPreview | null>(null);
  const [selected, setSelected] = useState<WordImportField[]>([]);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [stage, setStage] = useState<"choose" | "preview" | "confirm">(
    "choose"
  );
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const busy = previewMutation.isPending || applyMutation.isPending;
  const warnings = preview
    ? [...new Set(preview.warnings.map(friendlyWarning))]
    : [];

  useEffect(
    () => () => {
      requestRef.current++;
      abortRef.current?.abort();
    },
    []
  );

  const clear = () => {
    requestRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setSelected([]);
    setStage("choose");
    setError(null);
    setNeedsReload(false);
  };
  const close = () => {
    if (!applyMutation.isPending) {
      clear();
      onClose();
    }
  };
  const loadFile = async (file: File | undefined) => {
    if (applyMutation.isPending) return;
    clear();
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".docx") ||
      !file.size ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Выберите файл .docx размером не больше 5 МБ.");
      return;
    }
    const sequence = ++requestRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await previewMutation.mutateAsync({
        targetTemplateId,
        file,
        signal: controller.signal,
      });
      if (sequence !== requestRef.current) return;
      setPreview(result);
      setSelected(result.availableFields.filter((field) => field in labels));
      setStage("preview");
    } catch (cause) {
      if (sequence !== requestRef.current || controller.signal.aborted) return;
      setError(
        isAxiosError(cause) && cause.response?.status === 413
          ? "Файл слишком большой. Выберите DOCX не больше 5 МБ."
          : isAxiosError(cause) && cause.response?.status === 429
            ? "Разбор Word сейчас занят. Повторите попытку через минуту."
            : templateImportError(cause)
      );
    }
  };
  const apply = async () => {
    if (!preview || !selected.length || needsReload) return;
    setError(null);
    try {
      await applyMutation.mutateAsync({
        targetTemplateId,
        expectedRevision: preview.targetRevision,
        mode,
        selectedFields: selected,
        values: preview.values,
      });
      showSuccessMessage("Выбранные поля импортированы из Word");
      await onImported?.();
      close();
    } catch (cause) {
      setError(templateImportError(cause));
      if (isAxiosError(cause) && cause.response?.status === 409)
        setNeedsReload(true);
      setStage("preview");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="md"
      fullWidth
      aria-labelledby={titleId}
      sx={{ "& .MuiDialog-container": { pb: 8 } }}
      slotProps={{
        paper: {
          sx: {
            maxHeight: "calc(100dvh - 96px)",
            m: 2,
            "& .MuiButton-root": { typography: "button" },
          },
        },
      }}
    >
      <DialogTitle id={titleId}>Импортировать из Word</DialogTitle>
      <DialogContent sx={{ minHeight: 0, overflowWrap: "anywhere" }}>
        <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
          Импортируются только выбранные содержательные поля. Данные учебного
          плана, компетенции и ФОС сохраняются.
        </Typography>
        {onChooseSource && (
          <Button
            disabled={applyMutation.isPending}
            onClick={() => {
              if (applyMutation.isPending) return;
              clear();
              onChooseSource();
            }}
          >
            Выбрать РПД из комплекта
          </Button>
        )}
        <Box sx={{ my: 2 }}>
          <Button
            component="label"
            variant="outlined"
            disabled={applyMutation.isPending}
          >
            Выбрать файл .docx
            <input
              ref={inputRef}
              hidden
              type="file"
              disabled={applyMutation.isPending}
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => void loadFile(event.target.files?.[0])}
            />
          </Button>
        </Box>
        {previewMutation.isPending && (
          <Typography>Разбор документа…</Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ my: 1 }}>
            {error}
            {needsReload && (
              <Button onClick={clear}>Выбрать файл заново</Button>
            )}
          </Alert>
        )}
        {preview && (
          <>
            <Typography>
              Источник: {preview.source.discipline || preview.source.fileName}
              {preview.source.year ? ` • ${preview.source.year}` : ""}
            </Typography>
            {preview.source.department && (
              <Typography variant="body2">
                Кафедра: {preview.source.department}
              </Typography>
            )}
            {warnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                <Box component="ul" sx={{ my: 0, pl: 2 }}>
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </Box>
              </Alert>
            )}
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              Не распознаны в файле:{" "}
              {Object.entries(labels)
                .filter(
                  ([field]) =>
                    !preview.availableFields.includes(field as WordImportField)
                )
                .map(([, label]) => label)
                .join(", ") || "нет"}
              .
            </Typography>
            {preview.availableFields.length === 0 ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Совместимые поля не найдены. Выберите другой DOCX.
              </Alert>
            ) : (
              <Stack spacing={0.5} sx={{ mt: 2 }}>
                {preview.availableFields
                  .filter((field) => field in labels)
                  .map((field) => (
                    <Box
                      key={field}
                      sx={{ borderBottom: 1, borderColor: "divider", pb: 1 }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selected.includes(field)}
                            disabled={needsReload || applyMutation.isPending}
                            onChange={(event) =>
                              setSelected((current) =>
                                event.target.checked
                                  ? [...current, field]
                                  : current.filter((item) => item !== field)
                              )
                            }
                          />
                        }
                        label={labels[field]}
                      />
                      <Box sx={{ pl: { xs: 0, sm: 4 }, minWidth: 0 }}>
                        <FullFieldPreview
                          value={preview.values[field]}
                          content={field === "content"}
                        />
                      </Box>
                    </Box>
                  ))}
              </Stack>
            )}
            <Typography sx={{ mt: 2 }}>
              Как объединить выбранные поля?
            </Typography>
            <RadioGroup
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as "append" | "replace")
              }
            >
              <FormControlLabel
                value="append"
                disabled={applyMutation.isPending}
                control={<Radio />}
                label="Добавить к существующему"
              />
              <FormControlLabel
                value="replace"
                disabled={applyMutation.isPending}
                control={<Radio />}
                label="Заменить существующее"
              />
            </RadioGroup>
            {stage === "confirm" && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Подтвердите импорт {selected.length} полей.{" "}
                {mode === "replace"
                  ? "Их текущее содержимое будет заменено."
                  : "Содержимое будет добавлено к текущему."}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button onClick={close} disabled={applyMutation.isPending}>
          Отмена
        </Button>
        {stage === "confirm" && (
          <Button
            onClick={() => setStage("preview")}
            disabled={applyMutation.isPending}
          >
            Назад
          </Button>
        )}
        {preview && stage === "preview" && (
          <Button
            variant="contained"
            disabled={!selected.length || busy || needsReload}
            onClick={() => setStage("confirm")}
          >
            Продолжить
          </Button>
        )}
        {preview && stage === "confirm" && (
          <Button
            variant="contained"
            disabled={!selected.length || busy || needsReload}
            onClick={() => void apply()}
          >
            Импортировать выбранные поля
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
