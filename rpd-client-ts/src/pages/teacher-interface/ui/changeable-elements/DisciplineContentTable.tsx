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
import { normalizeContent } from "@pages/teacher-interface/lib/normalizeContent";
import {
  sameValue,
  useTemplateSync,
  useUpdateTemplateField,
  type FieldEdits,
} from "@entities/template";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import { useEffect } from "react";
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
    try {
      const updated = await useTemplateSync
        .getState()
        .track(saveStudyPlan(templateId, { hours: { [key]: value } }));
      if (useStore.getState().jsonData.id === templateId) {
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
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  return (
    <Box>
      <Box sx={{ position: "relative", my: 3 }}>
        <TableContainer component={Paper}>
          <Table
            sx={{ minWidth: 650, mb: 6 }}
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
                  readOnly={readOnly}
                  attestationTheme={attestationTheme}
                  onValueChange={changeRow}
                  onBlur={saveContent}
                />
              ))}
              <TableRow>
                <TableCell>Итого за семестр / курс</TableCell>
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
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: comparable
                            ? matches
                              ? "success.main"
                              : "error.main"
                            : "text.secondary",
                        }}
                      >
                        <span>{summ[key]}</span>
                        <span>/</span>
                        {canEdit && editable ? (
                          <TextField
                            type="number"
                            variant="outlined"
                            size="small"
                            value={
                              !manual.touched[
                                key as keyof typeof manual.touched
                              ] && planned === 0
                                ? ""
                                : planned
                            }
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
                              width: 70,
                              "& .MuiInputBase-input": {
                                fontSize: 14,
                                textAlign: "center",
                                p: 0.5,
                              },
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 0,
                                "& fieldset": { border: "none" },
                                padding: 0,
                              },
                            }}
                          />
                        ) : (key === "all"
                            ? plan.has_total
                            : plan.has_breakdown) || canEdit ? (
                          planned
                        ) : (
                          "—"
                        )}
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {!readOnly && (
          <Box sx={{ position: "absolute", bottom: 0, right: 8 }}>
            <ExportFromTemplates
              elementName="content"
              setChangeableValue={(value) =>
                setData(value as DisciplineContentData)
              }
            />
          </Box>
        )}
      </Box>
      {!readOnly && mismatches.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Часы не совпадают с учебным планом:{" "}
          {describeHoursMismatches(mismatches)}.
        </Alert>
      )}
      {!readOnly && (
        <Button variant="outlined" onClick={addRow}>
          Добавить строку
        </Button>
      )}
    </Box>
  );
}
