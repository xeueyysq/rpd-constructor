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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRpdComplectsQuery } from "@entities/rpd-complect/model/queries";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import type { ComplectData } from "@shared/types";

type ComplectTemplatesResponse = ComplectData & {
  templates: Array<{
    id: number;
    id_profile_template: number | null;
    discipline: string;
    teachers: string[];
    teacher: string;
    semester: number;
  }>;
};

export type ImportFromComplectsDialogProps = {
  open: boolean;
  targetTemplateId: number;
  appendParagraph?: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
};

export function ImportFromComplectsDialog({
  open,
  targetTemplateId,
  appendParagraph = true,
  onClose,
  onImported,
}: ImportFromComplectsDialogProps) {
  const { complects, isLoading, isError } = useRpdComplectsQuery();
  const [expandedComplectId, setExpandedComplectId] = useState<number | null>(
    null
  );
  const [templatesByComplectId, setTemplatesByComplectId] = useState<
    Record<number, ComplectTemplatesResponse["templates"]>
  >({});
  const [templatesLoading, setTemplatesLoading] = useState<
    Record<number, boolean>
  >({});
  const [templatesError, setTemplatesError] = useState<
    Record<number, string | null>
  >({});
  const [searchByComplectId, setSearchByComplectId] = useState<
    Record<number, string>
  >({});
  const [selectedSourceProfileTemplateId, setSelectedSourceProfileTemplateId] =
    useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);

  useEffect(() => {
    if (!open) {
      setExpandedComplectId(null);
      setTemplatesByComplectId({});
      setTemplatesLoading({});
      setTemplatesError({});
      setSearchByComplectId({});
      setSelectedSourceProfileTemplateId(null);
      setIsImporting(false);
      setOpenConfirmDialog(false);
    }
  }, [open]);

  const complectLabel = useCallback(
    (c: ComplectData) => `${c.profile} ${c.year}`,
    []
  );

  const fetchComplectTemplates = useCallback(
    async (complectId: number) => {
      if (templatesByComplectId[complectId]) return;
      if (templatesLoading[complectId]) return;

      setTemplatesLoading((p) => ({ ...p, [complectId]: true }));
      setTemplatesError((p) => ({ ...p, [complectId]: null }));

      try {
        const { data } = await axiosBase.post<ComplectTemplatesResponse>(
          "find-rpd",
          { complectId }
        );
        setTemplatesByComplectId((p) => ({
          ...p,
          [complectId]: data.templates ?? [],
        }));
      } catch (e) {
        console.error(e);
        setTemplatesError((p) => ({
          ...p,
          [complectId]: "Не удалось загрузить шаблоны комплекта",
        }));
      } finally {
        setTemplatesLoading((p) => ({ ...p, [complectId]: false }));
      }
    },
    [templatesByComplectId, templatesLoading]
  );

  const handleToggleComplect = useCallback(
    async (complectId: number) => {
      const next = expandedComplectId === complectId ? null : complectId;
      setExpandedComplectId(next);
      if (next !== null) {
        await fetchComplectTemplates(next);
      }
    },
    [expandedComplectId, fetchComplectTemplates]
  );

  const handleImport = useCallback(async () => {
    if (!selectedSourceProfileTemplateId) return;
    if (selectedSourceProfileTemplateId === targetTemplateId) {
      showErrorMessage("Нельзя импортировать шаблон сам в себя");
      return;
    }

    setIsImporting(true);
    try {
      const { data } = await axiosBase.post<{
        success?: boolean;
        message?: string;
      }>("copy-template-content", {
        sourceTemplateId: selectedSourceProfileTemplateId,
        targetTemplateId,
        appendParagraph,
      });
      if (data?.success === false) {
        showErrorMessage(data?.message || "Ошибка при импорте данных");
      } else {
        setOpenConfirmDialog(false);
        showSuccessMessage("Данные успешно импортированы");
        onClose();
        await onImported();
      }
    } catch (e) {
      console.error(e);
      showErrorMessage("Ошибка при импорте данных");
    } finally {
      setIsImporting(false);
    }
  }, [
    selectedSourceProfileTemplateId,
    targetTemplateId,
    appendParagraph,
    onClose,
    onImported,
  ]);

  const filteredTemplatesByComplectId = useMemo(() => {
    const result: Record<number, ComplectTemplatesResponse["templates"]> = {};
    for (const [idStr, templates] of Object.entries(templatesByComplectId)) {
      const complectId = Number(idStr);
      const q = (searchByComplectId[complectId] ?? "").trim().toLowerCase();

      const created = (templates ?? []).filter((t) => !!t.id_profile_template);
      const withoutSelf = created.filter(
        (t) => t.id_profile_template !== targetTemplateId
      );

      if (!q) {
        result[complectId] = withoutSelf;
        continue;
      }

      result[complectId] = withoutSelf.filter((t) => {
        const hay =
          `${t.discipline} ${t.teacher ?? ""} ${t.semester ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return result;
  }, [templatesByComplectId, searchByComplectId, targetTemplateId]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Импортировать данные из шаблона</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Выберите комплект, затем шаблон. Будут импортированы только
            контентные поля (без дисциплины, семестра, нагрузки, формы
            промежуточной аттестации и т.п.)
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {isLoading ? (
            <Typography color="text.secondary">Загрузка комплектов…</Typography>
          ) : isError ? (
            <Alert severity="error">
              Не удалось загрузить список комплектов
            </Alert>
          ) : complects.length === 0 ? (
            <Typography color="text.secondary">
              Нет доступных комплектов
            </Typography>
          ) : (
            <Box>
              {complects.map((c) => {
                const isExpanded = expandedComplectId === c.id;
                const templates = filteredTemplatesByComplectId[c.id] ?? [];
                const isTplLoading = templatesLoading[c.id];
                const tplError = templatesError[c.id];

                return (
                  <Accordion
                    key={c.id}
                    expanded={isExpanded}
                    onChange={() => handleToggleComplect(c.id)}
                    disableGutters
                    sx={{ mb: 1 }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box>
                        <Typography>{complectLabel(c)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.directionOfStudy} • {c.levelEducation} •{" "}
                          {c.formEducation}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TextField
                        value={searchByComplectId[c.id] ?? ""}
                        onChange={(e) =>
                          setSearchByComplectId((p) => ({
                            ...p,
                            [c.id]: e.target.value,
                          }))
                        }
                        size="small"
                        fullWidth
                        label="Поиск по шаблонам (дисциплина/преподаватель/семестр)"
                        sx={{ mb: 1 }}
                      />

                      {tplError ? (
                        <Alert severity="error" sx={{ mb: 1 }}>
                          {tplError}
                        </Alert>
                      ) : null}

                      {isTplLoading ? (
                        <Typography color="text.secondary">
                          Загрузка шаблонов…
                        </Typography>
                      ) : templates.length === 0 ? (
                        <Typography color="text.secondary">
                          В этом комплекте нет созданных шаблонов для импорта
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {templates.map((t) => {
                            const sourceId = t.id_profile_template!;
                            const selected =
                              selectedSourceProfileTemplateId === sourceId;
                            return (
                              <ListItemButton
                                key={sourceId}
                                selected={selected}
                                onClick={() =>
                                  setSelectedSourceProfileTemplateId(sourceId)
                                }
                                sx={{
                                  border: "1px solid",
                                  borderColor: selected
                                    ? "primary.main"
                                    : "divider",
                                  borderRadius: 1,
                                  mb: 1,
                                }}
                              >
                                <Radio checked={selected} value={sourceId} />
                                <ListItemText
                                  primary={
                                    <Box
                                      display="flex"
                                      justifyContent="space-between"
                                      gap={2}
                                    >
                                      <Box sx={{ minWidth: 0 }}>
                                        <Typography
                                          sx={{ fontWeight: 600 }}
                                          noWrap
                                        >
                                          {t.discipline}
                                        </Typography>
                                        <Typography
                                          variant="body2"
                                          color="text.secondary"
                                          noWrap
                                        >
                                          {t.teacher || "—"} • семестр{" "}
                                          {t.semester}
                                        </Typography>
                                      </Box>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        ID {sourceId}
                                      </Typography>
                                    </Box>
                                  }
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isImporting}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={() => setOpenConfirmDialog(true)}
            disabled={!selectedSourceProfileTemplateId || isImporting}
          >
            Импортировать
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={openConfirmDialog}
        onClose={() => !isImporting && setOpenConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Подтвердите импорт</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Контентные данные текущего шаблона будут изменены данными из
            выбранного шаблона:
          </Typography>
          <Box
            component="ul"
            sx={{
              m: 0,
              pl: 2.5,
              "& li": { mb: 1 },
              "& li:last-child": { mb: 0 },
            }}
          >
            <Typography component="li" variant="body2">
              Полностью заменятся: содержание дисциплины, компетенции, вопросы
              фонда оценочных средств.
            </Typography>
            <Typography component="li" variant="body2">
              Дополнятся к уже заполненному тексту: цели, протокол,
              дополнительные тексты разделов, шаблоны методической поддержки и
              оценочных средств, учебники, информационные ресурсы, программное
              обеспечение, материально-техническое обеспечение.
            </Typography>
            <Typography component="li" variant="body2">
              Не изменятся: форма промежуточной аттестации, дисциплина, семестр,
              нагрузка и другие служебные поля шаблона.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenConfirmDialog(false)}
            disabled={isImporting}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={isImporting}
          >
            Импортировать
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
