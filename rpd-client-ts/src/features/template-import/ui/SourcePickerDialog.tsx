import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CloseIcon from "@mui/icons-material/Close";
import useMediaQuery from "@mui/material/useMediaQuery";
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
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAuth } from "@entities/auth";
import {
  importSkipLabels,
  templateImportError,
  useCopyTemplateContent,
  useCopyTemplateField,
  useImportCatalog,
  useImportComplect,
  useImportFieldPreview,
  type ImportCatalogQuery,
  type ImportComplectResponse,
  type ImportField,
} from "@entities/template";
import { UserRole } from "@shared/ability";
import { useStore } from "@shared/hooks";
import { showSuccessMessage } from "@shared/lib";
import { CompactDialogTheme } from "@shared/ui";
import { FullFieldPreview } from "./FullFieldPreview";
import { WordImportDialog } from "./WordImportDialog";
import { SourcePickerTable } from "./SourcePickerTable";
import { sourceLabel } from "../lib/sourceLabel";

type Props = {
  open: boolean;
  targetLabel: string;
  onClose: () => void;
  onImported?: () => Promise<void> | void;
  fieldBaseAt?: string | null;
  onFieldImported?: (value: unknown) => void;
  initialMode?: "other-complect" | "other-year";
  initialMethod?: "source" | "word";
} & (
  | { field: ImportField; fieldLabel: string }
  | { field?: never; fieldLabel?: never }
) &
  (
    | { targetTemplateId: number; targetComplectId?: never }
    | { targetComplectId: number | string; targetTemplateId?: never }
  );

function FieldPreviewRegion({
  id,
  label,
  children,
}: {
  id: string;
  label?: string;
  children: ReactNode;
}) {
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    region.current?.focus({ preventScroll: true });
  }, []);
  return (
    <Box
      id={id}
      ref={region}
      tabIndex={0}
      role="region"
      aria-label={"Предпросмотр: " + label}
      sx={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        maxHeight: 320,
        overflow: "auto",
        overscrollBehavior: "contain",
        p: 1.5,
      }}
    >
      {children}
    </Box>
  );
}

export function SourcePickerDialog(props: Props) {
  return (
    <CompactDialogTheme>
      <SourcePickerSession {...props} />
    </CompactDialogTheme>
  );
}

function SourcePickerSession(props: Props) {
  const {
    open,
    onClose,
    onImported,
    field,
    fieldLabel,
    onFieldImported,
    initialMode = "other-complect",
    initialMethod = "source",
  } = props;
  const id = useId();
  const mobile = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  const bulk = props.targetComplectId != null;
  const scope = bulk ? "bulk" : field ? "field" : "single";
  const role = useAuth((state) => state.userRole);
  const ownOnly = Boolean(field) && role === UserRole.TEACHER;
  const [method, setMethod] = useState(initialMethod);
  const [mode, setMode] = useState(initialMode);
  const [readyOnly, setReadyOnly] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [hierarchy, setHierarchy] = useState({
    faculty: "",
    direction: "",
    profile: "",
  });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
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

  const searchSettled = search === searchInput.trim();
  const context = bulk
    ? { targetComplectId: props.targetComplectId! }
    : { targetTemplateId: props.targetTemplateId! };
  const query: ImportCatalogQuery = {
    ...context,
    scope,
    ...(field ? { sourceMode: mode, ownOnly } : {}),
    ...(scope === "single" && readyOnly ? { status: "ready" as const } : {}),
    ...(search ? { search } : {}),
    ...(hierarchy.faculty ? { faculty: hierarchy.faculty } : {}),
    ...(hierarchy.direction ? { direction: hierarchy.direction } : {}),
    ...(hierarchy.profile ? { profile: hierarchy.profile } : {}),
    page,
    pageSize: 10,
  };
  const catalog = useImportCatalog(
    query,
    open && method === "source" && searchSettled
  );
  // Не разрешаем выбор из старой страницы ни во время debounce, ни при refetch.
  const current =
    searchSettled &&
    !catalog.isFetching &&
    !catalog.isError &&
    Boolean(catalog.data);
  const complects = current ? (catalog.data?.complects ?? []) : [];
  const templates = current ? (catalog.data?.templates ?? []) : [];
  const selectedComplect = complects.find((row) => row.id === selectedId);
  const selectedTemplate = templates.find((row) => row.id === selectedId);
  const inspectedTemplate = templates.find((row) => row.id === previewId);
  const preview = useImportFieldPreview(
    inspectedTemplate ? [inspectedTemplate.id] : [],
    field ?? "goals",
    props.targetTemplateId ?? 0,
    open && Boolean(field && inspectedTemplate && method === "source"),
    ownOnly
  );
  const previewValue = preview.data?.find((row) => row.id === previewId);
  const copyContent = useCopyTemplateContent();
  const copyField = useCopyTemplateField();
  const importComplect = useImportComplect();
  const busy =
    copyContent.isPending || copyField.isPending || importComplect.isPending;
  const canContinue =
    current &&
    !busy &&
    !needsReload &&
    selectedRevision === catalog.data?.targetRevision &&
    Boolean(bulk ? selectedComplect : selectedTemplate);
  const title = field
    ? "Импортировать: " + fieldLabel
    : bulk
      ? "Импортировать все дисциплины"
      : "Импортировать данные РПД";

  const clearChoice = () => {
    setSelectedId(null);
    setSelectedRevision(null);
    setPreviewId(null);
    setConfirm(false);
    setResult(null);
    setError(null);
    setNeedsReload(false);
  };
  const changeHierarchy = (key: keyof typeof hierarchy, value: string) => {
    setHierarchy((previous) =>
      key === "faculty"
        ? { faculty: value, direction: "", profile: "" }
        : key === "direction"
          ? { ...previous, direction: value, profile: "" }
          : { ...previous, profile: value }
    );
    setPage(1);
    clearChoice();
  };
  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setReadyOnly(true);
    setHierarchy({ faculty: "", direction: "", profile: "" });
    setPage(1);
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
    if (!canContinue || !selectedRevision) return;
    setError(null);
    try {
      if (bulk && selectedComplect) {
        const imported = await importComplect.mutateAsync({
          sourceComplectId: selectedComplect.id,
          targetComplectId: props.targetComplectId!,
          targetRevision: selectedRevision,
        });
        setResult(imported);
        setConfirm(false);
        setSelectedId(null);
        setSelectedRevision(null);
        await onImported?.();
      } else if (field && selectedTemplate) {
        if (useStore.getState().jsonData.id !== props.targetTemplateId)
          throw new Error("Открыта другая РПД. Повторите импорт");
        const response = await copyField.mutateAsync({
          sourceTemplateId: selectedTemplate.id,
          targetTemplateId: props.targetTemplateId!,
          fieldToCopy: field,
          baseAt: fieldRevision,
          ownOnly,
        });
        onFieldImported?.(response.value);
        showSuccessMessage("Поле импортировано");
        await onImported?.();
        onClose();
      } else if (selectedTemplate) {
        await copyContent.mutateAsync({
          sourceTemplateId: selectedTemplate.id,
          targetTemplateId: props.targetTemplateId!,
          targetRevision: selectedRevision,
          ...(readyOnly ? { sourceStatus: "ready" as const } : {}),
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
    ["direction", "Направление", catalog.data?.facets.directions],
    ["profile", "Профиль", catalog.data?.facets.profiles],
  ] as const;
  const selectedSource = selectedComplect ?? selectedTemplate;
  const selectedLabel = selectedSource ? sourceLabel(selectedSource) : "";
  const skipCounts = result?.skipped.reduce<
    Partial<Record<keyof typeof importSkipLabels, number>>
  >(
    (counts, entry) => ({
      ...counts,
      [entry.reason]: (counts[entry.reason] ?? 0) + 1,
    }),
    {}
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={() => !busy && onClose()}
        maxWidth={false}
        fullWidth
        fullScreen={mobile}
        aria-labelledby={id + "-label"}
        sx={{ "& .MuiDialog-container": { pb: 8 } }}
        slotProps={{
          paper: {
            sx: {
              width: mobile ? "100%" : "calc(100% - 32px)",
              maxWidth: 1040,
              m: mobile ? 0 : 2,
              height: mobile
                ? "calc(100dvh - 64px)"
                : "min(980px, calc(100dvh - 88px))",
              maxHeight: mobile ? "calc(100dvh - 64px)" : "calc(100dvh - 88px)",
              overflow: "hidden",
              "& .MuiButton-root, & .MuiIconButton-root": {
                minHeight: 36,
                typography: "button",
              },
            },
          },
        }}
      >
        <DialogTitle
          id={id + "-title"}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: { xs: 2, sm: 3 },
          }}
        >
          <Box
            component="span"
            id={id + "-label"}
            sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
          >
            {title}
          </Box>
          {!bulk && !field && (
            <Tooltip title="Импортировать из Word">
              <IconButton
                aria-label="Импортировать из Word"
                disabled={busy}
                onClick={() => {
                  clearChoice();
                  setMethod("word");
                }}
              >
                <DescriptionOutlinedIcon />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            aria-label="Закрыть импорт"
            disabled={busy}
            onClick={onClose}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Box sx={{ px: { xs: 2, sm: 3 }, pb: 1.5 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1.5,
            }}
          >
            {facetFields.map(([key, label, values]) => (
              <Box key={key} sx={{ minWidth: 0 }}>
                <Typography
                  component="label"
                  htmlFor={id + "-" + key}
                  variant="caption"
                  sx={{
                    display: "flex",
                    alignItems: "flex-end",
                    height: { xs: "2lh", sm: 24 },
                    mb: 0.5,
                    color: "text.secondary",
                  }}
                >
                  {label}
                </Typography>
                <TextField
                  select
                  id={id + "-" + key}
                  fullWidth
                  disabled={busy}
                  value={hierarchy[key]}
                  onChange={(event) => changeHierarchy(key, event.target.value)}
                  slotProps={{ select: { native: true } }}
                  sx={{
                    "& .MuiInputBase-root": { height: 36, typography: "body2" },
                  }}
                >
                  <option value="">Все</option>
                  {Array.from(new Set([hierarchy[key], ...(values ?? [])]))
                    .filter(Boolean)
                    .map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                </TextField>
              </Box>
            ))}
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 1.5, alignItems: "center" }}
          >
            <TextField
              label="Поиск источников"
              type="search"
              fullWidth
              value={searchInput}
              disabled={busy}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
                clearChoice();
              }}
              sx={{
                minWidth: 0,
                "& .MuiInputBase-root": { height: 36, typography: "body2" },
              }}
            />
            <Button
              onClick={resetFilters}
              disabled={busy}
              sx={{ flexShrink: 0 }}
            >
              Сбросить
            </Button>
          </Stack>
          {scope === "single" && (
            <FormControlLabel
              sx={{ mt: 0.5, mb: -0.5 }}
              control={
                <Checkbox
                  checked={readyOnly}
                  disabled={busy}
                  onChange={(event) => {
                    setReadyOnly(event.target.checked);
                    setPage(1);
                    clearChoice();
                  }}
                />
              }
              label={<Typography variant="body2">Только готовые</Typography>}
            />
          )}
          {field && (
            <Tabs
              value={mode}
              aria-label="Источник раздела"
              variant="fullWidth"
              onChange={(_, value: typeof mode) => {
                setMode(value);
                setPage(1);
                clearChoice();
              }}
              sx={{
                mt: 0.5,
                minHeight: 36,
                "& .MuiTab-root": { minHeight: 36, px: 1 },
              }}
            >
              <Tab
                value="other-complect"
                label="Другой комплект"
                id={id + "-complect-tab"}
                aria-controls={id + "-results"}
                disabled={busy}
              />
              <Tab
                value="other-year"
                label="Другой год"
                id={id + "-year-tab"}
                aria-controls={id + "-results"}
                disabled={busy}
              />
            </Tabs>
          )}
        </Box>
        <DialogContent
          id={id + "-results"}
          role={field ? "tabpanel" : undefined}
          aria-labelledby={
            field
              ? id + (mode === "other-year" ? "-year-tab" : "-complect-tab")
              : undefined
          }
          sx={{
            p: 0,
            minHeight: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {(error || catalog.isError) && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error ?? templateImportError(catalog.error)}
              <Button
                disabled={busy || !searchSettled}
                onClick={() => void reload()}
              >
                Обновить данные
              </Button>
            </Alert>
          )}
          {result ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="success">
                Импортировано: {result.counts.imported}. Пропущено:{" "}
                {result.counts.skipped}. Всего: {result.counts.total}.
              </Alert>
              {Object.entries(skipCounts ?? {}).map(([reason, count]) => (
                <Typography key={reason} variant="body2" sx={{ mt: 1 }}>
                  {importSkipLabels[reason as keyof typeof importSkipLabels]}:{" "}
                  {count}
                </Typography>
              ))}
            </Box>
          ) : !current && !catalog.isError ? (
            <Typography role="status" sx={{ p: 3 }}>
              Загрузка источников…
            </Typography>
          ) : current && (bulk ? complects : templates).length === 0 ? (
            <Typography role="status" sx={{ p: 3 }}>
              По выбранным условиям источников нет. Измените фильтры.
            </Typography>
          ) : (
            <SourcePickerTable
              rows={bulk ? complects : templates}
              bulk={bulk}
              field={Boolean(field)}
              busy={busy}
              total={catalog.data?.total ?? 0}
              page={page}
              selectedId={selectedId}
              previewId={previewId}
              previewRegionId={id + "-preview"}
              onSelect={(sourceId) => {
                setSelectedId(sourceId);
                setSelectedRevision(catalog.data?.targetRevision ?? null);
                setError(null);
              }}
              onPreview={setPreviewId}
              onPage={(next) => {
                setPage(next);
                clearChoice();
              }}
              preview={
                <FieldPreviewRegion id={id + "-preview"} label={fieldLabel}>
                  {preview.isFetching ? (
                    <Typography role="status">
                      Загрузка предпросмотра…
                    </Typography>
                  ) : preview.isError ? (
                    <Alert severity="error">
                      {templateImportError(preview.error)}
                      <Button onClick={() => void preview.refetch()}>
                        Повторить
                      </Button>
                    </Alert>
                  ) : previewValue && field ? (
                    <FullFieldPreview
                      value={previewValue[field]}
                      content={field === "content"}
                    />
                  ) : null}
                </FieldPreviewRegion>
              }
            />
          )}
        </DialogContent>
        {!result && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 0.5,
              gap: 1,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {current ? "Найдено: " + catalog.data?.total : "Поиск…"}
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center" }}>
              <Button
                aria-label="Предыдущая страница"
                disabled={busy || !current || page === 1}
                onClick={() => {
                  setPage(page - 1);
                  clearChoice();
                }}
              >
                Назад
              </Button>
              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                {page} /{" "}
                {Math.max(1, Math.ceil((catalog.data?.total ?? 0) / 10))}
              </Typography>
              <Button
                aria-label="Следующая страница"
                disabled={
                  busy || !current || page * 10 >= (catalog.data?.total ?? 0)
                }
                onClick={() => {
                  setPage(page + 1);
                  clearChoice();
                }}
              >
                Далее
              </Button>
            </Stack>
          </Box>
        )}
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
          <Typography
            variant="body2"
            sx={{ mr: "auto", color: "text.secondary" }}
            role="status"
          >
            {result
              ? "Импорт завершён"
              : canContinue
                ? "Источник выбран"
                : "Выберите источник"}
          </Typography>
          <Button onClick={onClose} disabled={busy}>
            {result ? "Закрыть" : "Отмена"}
          </Button>
          {!result && (
            <Button
              variant="contained"
              disabled={!canContinue}
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
        aria-labelledby={id + "-confirm-title"}
        sx={{ "& .MuiDialog-container": { pb: 8 } }}
        slotProps={{
          paper: {
            sx: {
              maxHeight: "calc(100dvh - 88px)",
              m: 2,
              "& .MuiButton-root": { minHeight: 36, typography: "button" },
            },
          },
        }}
      >
        <DialogTitle id={id + "-confirm-title"}>Подтвердите импорт</DialogTitle>
        <DialogContent sx={{ overflowWrap: "anywhere" }}>
          <Typography sx={{ mb: 1 }}>Источник: {selectedLabel}</Typography>
          <Typography variant="body2">
            {bulk
              ? "Совпадения проверяются по названию, семестру и типу записи."
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
            disabled={!canContinue}
            onClick={() => void apply()}
          >
            Импортировать
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
