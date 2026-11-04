import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Radio,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import {
  importComplectLabel,
  importSkipLabels,
  matchesImportSource,
  templateImportError,
  useCopyTemplateContent,
  useImportComplect,
  useImportSources,
  type ImportComplectResponse,
  type ImportSources,
} from "@entities/template";
import { showSuccessMessage } from "@shared/lib";

type Props = {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onImported: () => Promise<void> | void;
} & (
  | { targetTemplateId: number; targetComplectId?: never }
  | { targetComplectId: number | string; targetTemplateId?: never }
);

export function ImportFromComplectsDialog({
  open,
  targetTemplateId,
  targetComplectId,
  targetLabel,
  onClose,
  onImported,
}: Props) {
  const bulk = targetComplectId != null;
  const sources = useImportSources(
    targetComplectId != null
      ? { targetComplectId }
      : { targetTemplateId: targetTemplateId! },
    open
  );
  const copy = useCopyTemplateContent();
  const importComplect = useImportComplect();
  const [catalog, setCatalog] = useState<ImportSources | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [result, setResult] = useState<ImportComplectResponse | null>(null);
  const busy = copy.isPending || importComplect.isPending;

  useEffect(() => {
    if (!catalog && sources.data && !sources.isFetching && !sources.isError)
      setCatalog(sources.data);
  }, [sources.data, sources.isFetching, sources.isError, catalog]);

  const reload = async () => {
    const refreshed = await sources.refetch();
    if (!refreshed.data || refreshed.isError) return;
    setCatalog(refreshed.data);
    setSelected(null);
    setConfirm(false);
    setNeedsReload(false);
    setError(null);
  };

  const handleImport = async () => {
    if (selected == null || !catalog || needsReload) return;
    setError(null);
    try {
      if (targetComplectId != null) {
        const imported = await importComplect.mutateAsync({
          sourceComplectId: selected,
          targetComplectId,
          targetRevision: catalog.targetRevision,
        });
        setResult(imported);
        setConfirm(false);
        await onImported();
      } else {
        await copy.mutateAsync({
          sourceTemplateId: selected,
          targetTemplateId: targetTemplateId!,
          targetRevision: catalog.targetRevision,
        });
        showSuccessMessage("Данные успешно импортированы");
        await onImported();
        onClose();
      }
    } catch (error) {
      setError(templateImportError(error));
      setNeedsReload(isAxiosError(error) && error.response?.status === 409);
      setConfirm(false);
    }
  };

  const selectedComplect = catalog?.complects.find((complect) =>
    bulk
      ? complect.id === selected
      : complect.templates.some((template) => template.id === selected)
  );
  const selectedTemplate = selectedComplect?.templates.find(
    (template) => template.id === selected
  );
  const sourceLabel = selectedComplect
    ? [
        bulk ? null : selectedTemplate?.disciplins_name,
        bulk ? null : `семестр ${selectedTemplate?.semester ?? "—"}`,
        importComplectLabel(selectedComplect),
      ]
        .filter(Boolean)
        .join(" • ")
    : "";

  return (
    <>
      <Dialog
        open={open}
        onClose={() => !busy && onClose()}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {bulk ? "Импортировать все дисциплины" : "Импортировать данные РПД"}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>Цель: {targetLabel}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {bulk
              ? "Выберите исходный комплект. Дисциплины сопоставляются по названию, точному семестру и типу записи."
              : "Выберите комплект, затем РПД."}{" "}
            Содержательные поля заменяются. Компетенции, оба раздела ФОС и
            данные учебного плана сохраняются.
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          {(error || sources.isError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error ?? templateImportError(sources.error)}
            </Alert>
          )}
          {(error || sources.isError) && (
            <Button
              disabled={busy || sources.isFetching}
              onClick={() => void reload()}
            >
              Обновить данные
            </Button>
          )}
          {result ? (
            <Box>
              <Alert severity="success">
                Импортировано: {result.counts.imported}. Пропущено:{" "}
                {result.counts.skipped}. Всего: {result.counts.total}.
              </Alert>
              {result.skipped.length > 0 && (
                <List dense>
                  {result.skipped.map((entry) => (
                    <ListItemText
                      key={entry.targetExchangeId}
                      primary={`${entry.discipline ?? "—"} • семестр ${entry.semester ?? "—"} • ${entry.record_type ?? "—"}`}
                      secondary={importSkipLabels[entry.reason]}
                    />
                  ))}
                </List>
              )}
            </Box>
          ) : !catalog ? (
            <Typography sx={{ color: "text.secondary" }}>
              {sources.isFetching
                ? "Загрузка источников…"
                : "Источники не загружены"}
            </Typography>
          ) : catalog.complects.length === 0 ? (
            <Typography>Нет доступных комплектов для импорта</Typography>
          ) : (
            catalog.complects.map((complect) =>
              bulk ? (
                <ListItemButton
                  key={complect.id}
                  selected={selected === complect.id}
                  onClick={() => setSelected(complect.id)}
                >
                  <Radio checked={selected === complect.id} />
                  <ListItemText
                    primary={importComplectLabel(complect)}
                    secondary={`${complect.faculty ?? ""} • комплект №${complect.id}`}
                  />
                </ListItemButton>
              ) : (
                <Accordion
                  key={complect.id}
                  expanded={expanded === complect.id}
                  onChange={() =>
                    setExpanded(expanded === complect.id ? null : complect.id)
                  }
                  disableGutters
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box>
                      <Typography>{importComplectLabel(complect)}</Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {complect.faculty} • комплект №{complect.id}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField
                      value={search[complect.id] ?? ""}
                      onChange={(event) =>
                        setSearch((previous) => ({
                          ...previous,
                          [complect.id]: event.target.value,
                        }))
                      }
                      size="small"
                      fullWidth
                      label="Поиск по дисциплине или преподавателю"
                      sx={{ mb: 1 }}
                    />
                    <List dense disablePadding>
                      {complect.templates
                        .filter((template) =>
                          matchesImportSource(
                            template,
                            search[complect.id] ?? ""
                          )
                        )
                        .map((template) => (
                          <ListItemButton
                            key={template.id}
                            selected={selected === template.id}
                            onClick={() => setSelected(template.id)}
                          >
                            <Radio checked={selected === template.id} />
                            <ListItemText
                              primary={template.disciplins_name ?? "—"}
                              secondary={`${template.participants.map((participant) => participant.fullname).join(", ") || "Преподаватели не назначены"} • семестр ${template.semester ?? "—"} • ${template.record_type ?? "—"} • РПД №${template.id}`}
                            />
                          </ListItemButton>
                        ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              )
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {result ? "Закрыть" : "Отмена"}
          </Button>
          {!result && (
            <Button
              variant="contained"
              onClick={() => setConfirm(true)}
              disabled={selected == null || busy || !catalog || needsReload}
            >
              Импортировать
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Подтвердите импорт</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>Цель: {targetLabel}</Typography>
          <Typography sx={{ mb: 1 }}>Источник: {sourceLabel}</Typography>
          <Typography variant="body2">
            {bulk
              ? "Содержательные поля совпавших дисциплин будут полностью заменены данными выбранного комплекта. Несовпавшие и недоступные дисциплины будут пропущены."
              : "Содержательные поля текущей РПД будут полностью заменены данными выбранной РПД."}{" "}
            Компетенции, вопросы и шаблон ФОС, дисциплина, семестр, нагрузки и
            аттестация останутся прежними.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)} disabled={busy}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleImport()}
            disabled={busy || needsReload}
          >
            Импортировать
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
