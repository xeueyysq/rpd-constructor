import {
  Alert,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  alpha,
  useTheme,
} from "@mui/material";
import type {
  DisciplineContentData,
  ObjectHours,
  StudyPlanHours,
} from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import {
  ATTESTATION_ROW_ID,
  useDisciplineContentData,
  useManualPlan,
} from "@pages/teacher-interface/model/useDisciplineContentData";
import {
  describeHoursMismatches,
  hoursMismatches,
  isComparableHour,
  parseHours,
} from "@pages/teacher-interface/lib/hours";
import { saveStudyPlan } from "@pages/teacher-interface/api/studyPlan";
import { getSessionGeneration, SessionChangedError } from "@shared/api";
import { normalizeContent } from "@pages/teacher-interface/lib/normalizeContent";
import {
  sameValue,
  useTemplateSync,
  useUpdateTemplateField,
  useClearTemplateControl,
  useTemplateWorkflow,
  templateImportError,
  type FieldEdits,
} from "@entities/template";
import { useStore } from "@shared/hooks";
import AddIcon from "@mui/icons-material/Add";
import { showErrorMessage } from "@shared/lib";
import { useEffect } from "react";
import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { ExportFromTemplates } from "./ExportFromTemplates";
import type {
  ContentTableType,
  EditableRowKey,
} from "./discipline-content-table/types";
import { DisciplineContentDataRow } from "./discipline-content-table/ui/DisciplineContentDataRow";
import { DisciplineContentTableHeader } from "./discipline-content-table/ui/DisciplineContentTableHeader";

const columns: { key: keyof ObjectHours; editable: boolean }[] = [
  { key: "all", editable: true },
  { key: "lectures", editable: true },
  { key: "seminars", editable: true },
  { key: "contact", editable: false },
  { key: "independent_work", editable: true },
  { key: "control", editable: true },
];
const emptyPlan: StudyPlanHours = {
  all: 0,
  lectures: 0,
  seminars: 0,
  contact: 0,
  independent_work: 0,
  control: 0,
  has_total: false,
  has_breakdown: false,
};

export function DisciplineContentTable({
  readOnly = false,
  canEditPlan = false,
  tableData,
}: ContentTableType) {
  const theme = useTheme();
  const jsonData = useStore((state) => state.jsonData);
  const updateJsonData = useStore((state) => state.updateJsonData);
  const saveField = useUpdateTemplateField();
  const role = useAuth((state) => state.userRole);
  const workflow = useTemplateWorkflow(readOnly ? undefined : jsonData.id);
  const clearControl = useClearTemplateControl();
  const hasDirty = useTemplateSync(
    (state) => Object.keys(state.dirty).length > 0
  );
  const pending = useTemplateSync((state) => state.pending);
  const canClearControl =
    !readOnly &&
    (role === UserRole.ROP || role === UserRole.ADMIN) &&
    Boolean(workflow.data?.canEditTeachers);
  const plan =
    (jsonData?.study_plan_hours as StudyPlanHours | undefined) ?? emptyPlan;
  const { data, setData, nextId, setNextId, rowIds, summ } =
    useDisciplineContentData(
      tableData,
      jsonData?.content as DisciplineContentData | undefined,
      jsonData?.id
    );
  const manual = useManualPlan(plan, jsonData?.id);
  const canEdit = canEditPlan && !readOnly;
  const displayedPlan = canEdit ? manual.values : plan;
  const mismatches = hoursMismatches(summ, displayedPlan, manual.touched);
  const label = jsonData.certification
    ? String(jsonData.certification).toLowerCase()
    : "не выбрано";
  const attestationTheme = `Промежуточная аттестация: ${label}`;

  useEffect(() => {
    setData((previous) => ({
      ...previous,
      [ATTESTATION_ROW_ID]: {
        theme: attestationTheme,
        lectures: 0,
        seminars: 0,
        control: previous[ATTESTATION_ROW_ID]?.control ?? plan.control,
        independent_work: 0,
        competence: "",
        indicator: "",
        results: "",
      },
    }));
  }, [attestationTheme, plan.control, jsonData?.id, setData]);

  const changeRow = (
    rowId: string,
    key: EditableRowKey,
    value: string | number | null
  ) => {
    useTemplateSync.getState().markDirty("content");
    setData((previous) => ({
      ...previous,
      [rowId]: { ...previous[rowId], [key]: value },
    }));
  };
  const addRow = () => {
    useTemplateSync.getState().markDirty("content");
    setNextId((previous) => previous + 1);
    setData((previous) => ({
      ...previous,
      [String(nextId)]: {
        theme: "",
        lectures: null,
        seminars: null,
        control: null,
        independent_work: null,
        competence: "",
        indicator: "",
        results: "",
      },
    }));
  };
  const saveContent = () => {
    const content = normalizeContent(data);
    const stored = normalizeContent(
      useStore.getState().jsonData.content as DisciplineContentData | undefined
    );
    if (sameValue(content, stored)) {
      useTemplateSync.getState().clearDirty("content");
      return;
    }
    void saveField("content", content);
  };

  const clearRowControl = async (rowId: string) => {
    const sync = useTemplateSync.getState();
    if (!canClearControl || sync.pending || Object.keys(sync.dirty).length) {
      showErrorMessage(
        "Сначала сохраните или отмените локальные изменения РПД"
      );
      return;
    }
    const current = useStore.getState().jsonData;
    try {
      await clearControl.mutateAsync({
        templateId: current.id,
        rowId,
        baseAt:
          (current.field_edits as FieldEdits | undefined)?.content?.at ?? null,
      });
    } catch (error) {
      showErrorMessage(templateImportError(error));
    }
  };

  const savePlanHour = async (key: Exclude<keyof ObjectHours, "contact">) => {
    const value = manual.values[key];
    const current = useStore.getState().jsonData.study_plan_hours as
      StudyPlanHours | undefined;
    if (value === (current?.[key] ?? 0)) {
      if (manual.settle(key, value))
        useTemplateSync.getState().clearDirty("study_load");
      return;
    }
    const templateId = jsonData.id;
    if (!templateId) return;
    const generation = getSessionGeneration();
    try {
      const updated = await useTemplateSync
        .getState()
        .track(saveStudyPlan(templateId, { hours: { [key]: value } }));
      if (
        generation === getSessionGeneration() &&
        useStore.getState().jsonData.id === templateId
      ) {
        updateJsonData("study_load", updated.study_load);
        updateJsonData("zet", updated.zet);
        updateJsonData("study_plan_hours", updated.study_plan_hours);
        updateJsonData("field_edits", {
          ...(useStore.getState().jsonData.field_edits as
            FieldEdits | undefined),
          ...updated.edits,
        });
        if (manual.settle(key, value))
          useTemplateSync.getState().clearDirty("study_load");
      }
    } catch (error) {
      if (
        generation !== getSessionGeneration() ||
        error instanceof SessionChangedError
      )
        return;
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  return (
    <Box>
      <Box sx={{ position: "relative", my: 3 }}>
        <TableContainer component={Paper}>
          <Table
            sx={{ minWidth: 650, mb: 6, "&.table": { tableLayout: "auto" } }}
            size="small"
            aria-label="Содержание дисциплины"
            className="table"
          >
            <TableHead>
              <DisciplineContentTableHeader />
            </TableHead>
            <TableBody>
              {rowIds.map((rowId) => (
                <DisciplineContentDataRow
                  key={rowId}
                  rowId={rowId}
                  row={data[rowId]}
                  readOnly={readOnly || clearControl.isPending}
                  attestationTheme={attestationTheme}
                  onValueChange={changeRow}
                  onBlur={saveContent}
                  onClearControl={
                    canClearControl
                      ? () => void clearRowControl(rowId)
                      : undefined
                  }
                  clearDisabled={
                    hasDirty || pending > 0 || clearControl.isPending
                  }
                />
              ))}
              <TableRow sx={{ "& > td:not(:first-of-type)": { px: 0.5 } }}>
                <TableCell>
                  Итого за семестр / курс
                  <br />В учебном плане / В РПД
                </TableCell>
                {columns.map(({ key, editable }) => {
                  const comparable = isComparableHour(
                    key,
                    displayedPlan,
                    manual.touched
                  );
                  const planned = displayedPlan[key];
                  const matches = summ[key] === planned;
                  return (
                    <TableCell
                      key={key}
                      sx={
                        comparable && !matches
                          ? {
                              backgroundColor: alpha(
                                theme.palette.error.main,
                                0.08
                              ),
                            }
                          : undefined
                      }
                    >
                      {/* Цвет — на вложенном Box: .table td в global.css перекрывает color ячейки. */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 0.25,
                          color: comparable
                            ? matches
                              ? "success.main"
                              : "error.main"
                            : "text.secondary",
                        }}
                      >
                        {canEdit && editable ? (
                          <TextField
                            type="number"
                            variant="outlined"
                            size="small"
                            value={comparable || planned !== 0 ? planned : ""}
                            placeholder="—"
                            onChange={(event) => {
                              useTemplateSync
                                .getState()
                                .markDirty("study_load");
                              manual.change(
                                key as Exclude<keyof ObjectHours, "contact">,
                                parseHours(event.target.value)
                              );
                            }}
                            onBlur={() =>
                              void savePlanHour(
                                key as Exclude<keyof ObjectHours, "contact">
                              )
                            }
                            slotProps={{ htmlInput: { min: 0 } }}
                            sx={{
                              width: `${String(planned).length + 2}ch`,
                              fontSize: "inherit",
                              flexShrink: 0,
                              "& .MuiInputBase-input": {
                                fontSize: 14,
                                textAlign: "right",
                                p: 0.5,
                                MozAppearance: "textfield",
                                "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button":
                                  { WebkitAppearance: "none", m: 0 },
                              },
                              "& .MuiOutlinedInput-root": {
                                color: "inherit",
                                borderRadius: 0,
                                "& fieldset": { border: "none" },
                                padding: 0,
                              },
                            }}
                          />
                        ) : comparable || (canEdit && planned !== 0) ? (
                          planned
                        ) : (
                          "—"
                        )}
                        <span>/</span>
                        <span>{summ[key]}</span>
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      {!readOnly && mismatches.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Часы не совпадают с учебным планом:{" "}
          {describeHoursMismatches(mismatches)}.
        </Alert>
      )}
      {!readOnly && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={clearControl.isPending}
            onClick={addRow}
          >
            Добавить строку
          </Button>
          <ExportFromTemplates
            elementName="content"
            setChangeableValue={(value) =>
              setData((value ?? {}) as DisciplineContentData)
            }
          />
        </Box>
      )}
    </Box>
  );
}
