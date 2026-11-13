import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "@entities/auth";
import {
  importComplectLabel,
  importSkipLabels,
  templateImportError,
  useCopyTemplateContent,
  useCopyTemplateField,
  useImportCatalog,
  useImportComplect,
  useImportFieldPreview,
  useImportSourceDetails,
  type ImportCatalogQuery,
  type ImportCatalogSummary,
  type ImportComplectResponse,
  type ImportField,
  type ImportSourceTemplate,
} from "@entities/template";
import { UserRole } from "@shared/ability";
import { useStore } from "@shared/hooks";
import { showSuccessMessage } from "@shared/lib";
import { WordImportDialog } from "./WordImportDialog";

type Props = {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onImported?: () => Promise<void> | void;
  field?: ImportField;
  fieldBaseAt?: string | null;
  onFieldImported?: (value: unknown) => void;
  initialMode?: "other-complect" | "other-year";
  initialMethod?: "source" | "word";
} & (
  | { targetTemplateId: number; targetComplectId?: never }
  | { targetComplectId: number | string; targetTemplateId?: never }
);

const statuses = [
  ["ready", "Готов"],
  ["in_progress", "В работе"],
  ["on_refinement", "На доработке"],
  ["on_teacher", "Назначены преподаватели"],
  ["created", "Создан"],
  ["unloaded", "Выгружен из 1С"],
  ["closed", "Закрыт"],
] as const;

function sourceDescription(source: ImportCatalogSummary) {
  return [source.faculty, importComplectLabel(source)]
    .filter(Boolean)
    .join(" • ");
}

function recordTypeLabel(type: string | null) {
  if (type === "discipline") return "Дисциплина";
  if (type === "practice") return "Практика";
  return type || "—";
}

function previewText(value: unknown) {
  if (typeof value === "string")
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 240);
  if (Array.isArray(value)) return value.map(String).join(", ").slice(0, 240);
  return value == null ? "Поле пустое" : "Структурированные данные";
}

export function SourcePickerDialog(props: Props) {
  const {
    open,
    targetLabel,
    onClose,
    onImported,
    field,
    onFieldImported,
    initialMode = "other-complect",
    initialMethod = "source",
  } = props;
  const bulk = props.targetComplectId != null;
  const role = useAuth((state) => state.userRole);
  const ownOnly = !bulk && role === UserRole.TEACHER;
  const [method, setMethod] = useState(initialMethod);
  const [mode, setMode] = useState<"other-complect" | "other-year">(
    initialMode
  );
  const [status, setStatus] = useState<string>("ready");
  const [sameNameOnly, setSameNameOnly] = useState(!bulk);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [hierarchy, setHierarchy] = useState({
    faculty: "",
    educationLevel: "",
    direction: "",
    profile: "",
    educationForm: "",
    year: "",
  });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedComplect, setSelectedComplect] =
    useState<ImportCatalogSummary | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ImportSourceTemplate | null>(null);
  const [fieldRevision, setFieldRevision] = useState<string | null>(
    props.fieldBaseAt ?? null
  );
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [result, setResult] = useState<ImportComplectResponse | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const context = bulk
    ? { targetComplectId: props.targetComplectId! }
    : { targetTemplateId: props.targetTemplateId!, ownOnly };
  const query: ImportCatalogQuery = {
    ...context,
    sourceMode: mode,
    sameNameOnly: !bulk && sameNameOnly,
    ...(status ? { status: status as ImportCatalogQuery["status"] } : {}),
    ...(search ? { search } : {}),
    ...(hierarchy.faculty ? { faculty: hierarchy.faculty } : {}),
    ...(hierarchy.educationLevel
      ? { educationLevel: hierarchy.educationLevel }
      : {}),
    ...(hierarchy.direction ? { direction: hierarchy.direction } : {}),
    ...(hierarchy.profile ? { profile: hierarchy.profile } : {}),
    ...(hierarchy.educationForm
      ? { educationForm: hierarchy.educationForm }
      : {}),
    ...(hierarchy.year ? { year: Number(hierarchy.year) } : {}),
    page,
    pageSize: 10,
  };
  const catalog = useImportCatalog(query, open && method === "source");
  const details = useImportSourceDetails(
    { ...query, sourceComplectId: expanded ?? 0 },
    open && method === "source" && expanded != null
  );
  const preview = useImportFieldPreview(
    selectedTemplate ? [selectedTemplate.id] : [],
    field ?? "goals",
    props.targetTemplateId ?? 0,
    open && Boolean(field && selectedTemplate && method === "source"),
    ownOnly
  );
  const copyContent = useCopyTemplateContent();
  const copyField = useCopyTemplateField();
  const importComplect = useImportComplect();
  const busy =
    copyContent.isPending || copyField.isPending || importComplect.isPending;

  const clearChoice = () => {
    setExpanded(null);
    setSelectedComplect(null);
    setSelectedTemplate(null);
    setConfirm(false);
    setResult(null);
    setError(null);
    setNeedsReload(false);
  };
  const changeHierarchy = (key: keyof typeof hierarchy, value: string) => {
    const keys = Object.keys(hierarchy) as Array<keyof typeof hierarchy>;
    const changed = keys.indexOf(key);
    setHierarchy(
      (current) =>
        Object.fromEntries(
          keys.map((item, index) => [
            item,
            index < changed ? current[item] : index === changed ? value : "",
          ])
        ) as typeof hierarchy
    );
    setPage(1);
    clearChoice();
  };
  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("ready");
    setHierarchy({
      faculty: "",
      educationLevel: "",
      direction: "",
      profile: "",
      educationForm: "",
      year: "",
    });
    setPage(1);
    setSameNameOnly(!bulk);
    clearChoice();
  };
  const reload = async () => {
    clearChoice();
    const refreshed = await catalog.refetch();
    if (refreshed.isError) setError(templateImportError(refreshed.error));
    else if (field) {
      const active = useStore.getState().jsonData;
      if (active.id === props.targetTemplateId)
        setFieldRevision(active.field_edits?.[field]?.at ?? null);
    }
  };
  const apply = async () => {
    if (
      !catalog.data ||
      !selectedComplect ||
      needsReload ||
      (!bulk && !selectedTemplate)
    )
      return;
    setError(null);
    try {
      if (bulk) {
        const imported = await importComplect.mutateAsync({
          sourceComplectId: selectedComplect.id,
          targetComplectId: props.targetComplectId!,
          targetRevision: catalog.data.targetRevision,
          sourceStatus: status
            ? (status as ImportCatalogQuery["status"])
            : null,
        });
        setResult(imported);
        setConfirm(false);
        await onImported?.();
      } else if (field) {
        const active = useStore.getState().jsonData;
        if (active.id !== props.targetTemplateId)
          throw new Error("Открыта другая РПД. Повторите импорт");
        const response = await copyField.mutateAsync({
          sourceTemplateId: selectedTemplate!.id,
          targetTemplateId: props.targetTemplateId!,
          fieldToCopy: field,
          baseAt: fieldRevision,
          ownOnly,
        });
        onFieldImported?.(response.value);
        showSuccessMessage("Поле импортировано");
        await onImported?.();
        onClose();
      } else {
        await copyContent.mutateAsync({
          sourceTemplateId: selectedTemplate!.id,
          targetTemplateId: props.targetTemplateId!,
          targetRevision: catalog.data.targetRevision,
          ownOnly,
        });
        showSuccessMessage("Данные РПД импортированы");
        await onImported?.();
        onClose();
      }
    } catch (cause) {
      setError(templateImportError(cause));
      setNeedsReload(isAxiosError(cause) && cause.response?.status === 409);
      if (isAxiosError(cause) && cause.response?.status === 403) {
        clearChoice();
        setError(
          "Доступ к источнику изменился. Обновите список и выберите источник заново."
        );
      }
      setConfirm(false);
    }
  };

  if (method === "word" && !bulk && !field)
    return (
      <WordImportDialog
        open={open}
        targetTemplateId={props.targetTemplateId!}
        targetLabel={targetLabel}
        onClose={onClose}
        onImported={onImported}
        onChooseSource={() => {
          clearChoice();
          setMethod("source");
        }}
      />
    );

  const facetFields = [
    ["faculty", "Факультет / институт", catalog.data?.facets.faculties],
    [
      "educationLevel",
      "Уровень образования",
      catalog.data?.facets.educationLevels,
    ],
    ["direction", "Направление", catalog.data?.facets.directions],
    ["profile", "Профиль", catalog.data?.facets.profiles],
    ["educationForm", "Форма обучения", catalog.data?.facets.educationForms],
    ["year", "Год", catalog.data?.facets.years],
  ] as const;
  const selectedLabel = selectedComplect
    ? [
        selectedTemplate?.disciplins_name,
        selectedTemplate ? `семестр ${selectedTemplate.semester ?? "—"}` : null,
        selectedTemplate ? recordTypeLabel(selectedTemplate.record_type) : null,
        sourceDescription(selectedComplect),
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
          {field
            ? "Импортировать поле"
            : bulk
              ? "Импортировать все дисциплины"
              : "Импортировать данные РПД"}
        </DialogTitle>
        <DialogContent sx={{ minHeight: 360 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Цель: {targetLabel}
          </Alert>
          {!bulk && !field && (
            <Button
              onClick={() => {
                clearChoice();
                setMethod("word");
              }}
            >
              Импортировать из Word
            </Button>
          )}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ my: 1 }}
          >
            <Button
              variant={mode === "other-complect" ? "contained" : "outlined"}
              onClick={() => {
                setMode("other-complect");
                setPage(1);
                clearChoice();
              }}
            >
              Из другого комплекта
            </Button>
            <Button
              variant={mode === "other-year" ? "contained" : "outlined"}
              onClick={() => {
                setMode("other-year");
                setPage(1);
                clearChoice();
              }}
            >
              Из другого года
            </Button>
          </Stack>
          <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
            {bulk
              ? "Дисциплины сопоставляются по точному названию, семестру и типу записи."
              : "Выберите комплект и дисциплину. Содержательные поля будут заменены."}{" "}
            Компетенции и ФОС сохраняются.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ mb: 1 }}
          >
            <TextField
              label="Поиск по всем комплектам и дисциплинам"
              size="small"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
                clearChoice();
              }}
              fullWidth
            />
            <TextField
              select
              label="Статус исходной дисциплины"
              size="small"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
                clearChoice();
              }}
              sx={{ minWidth: 210 }}
            >
              <MenuItem value="">Все статусы</MenuItem>
              {statuses.map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {!bulk && (
            <FormControlLabel
              control={
                <Switch
                  checked={!sameNameOnly}
                  onChange={(event) => {
                    setSameNameOnly(!event.target.checked);
                    setPage(1);
                    clearChoice();
                  }}
                />
              }
              label="Показать другие дисциплины"
            />
          )}
          <Accordion disableGutters sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              Уточнить образовательную программу
            </AccordionSummary>
            <AccordionDetails>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1,
                }}
              >
                {facetFields.map(([key, label, values]) => (
                  <TextField
                    key={key}
                    select
                    size="small"
                    label={label}
                    sx={{ minWidth: 0 }}
                    value={hierarchy[key]}
                    onChange={(event) =>
                      changeHierarchy(key, event.target.value)
                    }
                  >
                    <MenuItem value="">Все</MenuItem>
                    {(values ?? []).map((value) => (
                      <MenuItem key={String(value)} value={String(value)}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
          <Button size="small" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
          {(error || catalog.isError) && (
            <Alert severity="error" sx={{ my: 1 }}>
              {error ?? templateImportError(catalog.error)}{" "}
              <Button onClick={() => void reload()}>Обновить данные</Button>
            </Alert>
          )}
          {result ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success">
                Импортировано: {result.counts.imported}. Пропущено:{" "}
                {result.counts.skipped}. Всего: {result.counts.total}.
              </Alert>
              {result.skipped.map((entry) => (
                <Typography
                  key={entry.targetExchangeId}
                  variant="body2"
                  sx={{ mt: 1 }}
                >
                  {entry.discipline ?? "—"} • семестр {entry.semester ?? "—"} •{" "}
                  {recordTypeLabel(entry.record_type)}:{" "}
                  {importSkipLabels[entry.reason]}
                </Typography>
              ))}
            </Box>
          ) : catalog.isPending || catalog.isFetching ? (
            <Typography sx={{ my: 2 }}>Загрузка источников…</Typography>
          ) : !catalog.isError && catalog.data?.complects.length === 0 ? (
            <Alert severity="info" sx={{ my: 2 }}>
              По выбранным условиям источников нет. Измените фильтры или статус.
            </Alert>
          ) : (
            !catalog.isError &&
            catalog.data?.complects.map((source) => (
              <Box
                key={source.id}
                sx={{
                  border: 1,
                  borderColor:
                    selectedComplect?.id === source.id
                      ? "primary.main"
                      : "divider",
                  borderRadius: 1,
                  mb: 1,
                  p: 1,
                }}
              >
                <Typography>{sourceDescription(source)}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Комплект №{source.id} • совпадений:{" "}
                  {source.matchingTemplateCount}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  {bulk && (
                    <Button
                      size="small"
                      aria-pressed={selectedComplect?.id === source.id}
                      onClick={() => {
                        setSelectedComplect(source);
                        setSelectedTemplate(null);
                      }}
                    >
                      Выбрать комплект
                    </Button>
                  )}
                  <Button
                    size="small"
                    aria-expanded={expanded === source.id}
                    onClick={() => {
                      setExpanded(expanded === source.id ? null : source.id);
                      if (!bulk) {
                        setSelectedComplect(null);
                        setSelectedTemplate(null);
                      }
                    }}
                  >
                    {expanded === source.id
                      ? "Скрыть дисциплины"
                      : "Показать дисциплины"}
                  </Button>
                </Stack>
                {expanded === source.id && (
                  <Box sx={{ mt: 1 }}>
                    {details.isFetching ? (
                      <Typography>Загрузка дисциплин…</Typography>
                    ) : details.isError ? (
                      <Alert severity="error">
                        {templateImportError(details.error)}{" "}
                        <Button onClick={() => void details.refetch()}>
                          Повторить
                        </Button>
                      </Alert>
                    ) : details.data?.complects[0]?.templates.length === 0 ? (
                      <Typography>
                        В этом комплекте нет подходящих дисциплин.
                      </Typography>
                    ) : (
                      details.data?.complects[0]?.templates.map((template) => (
                        <Button
                          key={template.id}
                          fullWidth
                          disabled={bulk}
                          sx={{
                            justifyContent: "flex-start",
                            textAlign: "left",
                            whiteSpace: "normal",
                          }}
                          aria-pressed={selectedTemplate?.id === template.id}
                          onClick={() => {
                            setSelectedComplect(source);
                            setSelectedTemplate(template);
                          }}
                        >
                          {template.disciplins_name ?? "—"} • семестр{" "}
                          {template.semester ?? "—"} •{" "}
                          {recordTypeLabel(template.record_type)} •{" "}
                          {statuses.find(
                            ([code]) => code === template.status
                          )?.[1] ?? template.status}
                        </Button>
                      ))
                    )}
                  </Box>
                )}
              </Box>
            ))
          )}
          {!result &&
            catalog.data &&
            catalog.data.total > catalog.data.pageSize && (
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1, alignItems: "center" }}
              >
                <Button
                  disabled={page === 1}
                  onClick={() => {
                    setPage(page - 1);
                    clearChoice();
                  }}
                >
                  Назад
                </Button>
                <Typography>
                  Страница {page} из{" "}
                  {Math.ceil(catalog.data.total / catalog.data.pageSize)}
                </Typography>
                <Button
                  disabled={page * catalog.data.pageSize >= catalog.data.total}
                  onClick={() => {
                    setPage(page + 1);
                    clearChoice();
                  }}
                >
                  Далее
                </Button>
              </Stack>
            )}
          {field && selectedTemplate && (
            <Box sx={{ mt: 1 }}>
              {preview.isFetching ? (
                "Загрузка предпросмотра поля…"
              ) : preview.isError ? (
                <Alert severity="error">
                  {templateImportError(preview.error)}
                </Alert>
              ) : (
                <Typography variant="body2">
                  Предпросмотр: {previewText(preview.data?.[0]?.[field])}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {result ? "Закрыть" : "Отмена"}
          </Button>
          {!result && (
            <Button
              variant="contained"
              disabled={
                busy ||
                needsReload ||
                !catalog.data ||
                !selectedComplect ||
                (!bulk && !selectedTemplate) ||
                Boolean(
                  field &&
                  (!preview.data?.length ||
                    preview.isFetching ||
                    preview.isError)
                )
              }
              onClick={() => setConfirm(true)}
            >
              Продолжить
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
          <Typography sx={{ mb: 1 }}>Источник: {selectedLabel}</Typography>
          <Typography variant="body2">
            {bulk
              ? `Будут перенесены только дисциплины со статусом «${statuses.find(([code]) => code === status)?.[1] ?? "любой"}». Совпадения проверяются по названию, семестру и типу записи.`
              : field
                ? "Выбранное поле будет заменено."
                : "Содержательные поля РПД будут заменены."}{" "}
            Компетенции и ФОС сохраняются.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)} disabled={busy}>
            Назад
          </Button>
          <Button
            variant="contained"
            disabled={busy || needsReload}
            onClick={() => void apply()}
          >
            Импортировать
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
