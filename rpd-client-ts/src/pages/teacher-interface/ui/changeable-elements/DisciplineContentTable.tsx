import {
  Box,
  Button,
  ButtonGroup,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import {
  DisciplineContentData,
  ObjectHours,
} from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useEffect, useMemo } from "react";
import { ExportFromTemplates } from "./ExportFromTemplates";
import { saveDisciplineContent } from "./discipline-content-table/api";
import {
  useDisciplineContentData,
  useDisciplineContentMaxHours,
  useManualPlan,
} from "./discipline-content-table/hooks";
import {
  ATTESTATION_ROW_ID,
  ContentTableType,
  EditableRowKey,
  StudyLoadSaveItem,
} from "./discipline-content-table/types";
import { isHoursEqual, toNumberSafe } from "./discipline-content-table/utils";
import { DisciplineContentDataRow } from "./discipline-content-table/ui/DisciplineContentDataRow";
import { DisciplineContentTableHeader } from "./discipline-content-table/ui/DisciplineContentTableHeader";

type ValidationState = "neutral" | "error" | "success";

function getValidationState(
  hours: number,
  maxHours: number,
  isComparable: boolean,
  hasComparableMax: boolean
): ValidationState {
  if (!hasComparableMax) return "neutral";
  if (!isComparable) return "neutral";
  if (toNumberSafe(hours) !== toNumberSafe(maxHours)) return "error";
  return "success";
}

function getValidationCellSx(
  hours: number,
  maxHours: number,
  isComparable: boolean,
  hasComparableMax: boolean
) {
  const validationState = getValidationState(
    hours,
    maxHours,
    isComparable,
    hasComparableMax
  );

  if (validationState === "error") {
    return {
      color: "error.main",
      backgroundColor: "rgba(211, 47, 47, 0.08)",
    };
  }

  if (validationState === "success") {
    return {
      color: "success.main",
    };
  }

  return {
    color: "text.secondary",
  };
}

export function DisciplineContentTable({
  readOnly = false,
  tableData,
}: ContentTableType) {
  const jsonData = useStore((state) => state.jsonData);
  const updateJsonData = useStore((state) => state.updateJsonData);
  const storeData = jsonData?.content as DisciplineContentData | undefined;

  const { maxHours, hasBreakdownHours, hasMaxHours } =
    useDisciplineContentMaxHours(jsonData?.study_load, jsonData?.control_load);

  const { data, setData, nextId, setNextId, rowIds, summ } =
    useDisciplineContentData({
      tableData,
      storeData,
      templateId: jsonData?.id,
    });

  const {
    manualPlanEnabled,
    setManualPlan,
    manualPlanTouchedTotal,
    setManualPlanTouchedTotal,
    manualPlanTouchedBreakdown,
    setManualPlanTouchedBreakdown,
    manualPlanNumeric,
    displayMaxHours,
  } = useManualPlan(maxHours, readOnly, jsonData?.id);

  const canCompareTotal =
    hasBreakdownHours || manualPlanTouchedTotal || manualPlanTouchedBreakdown;
  const canCompareBreakdown = hasBreakdownHours || manualPlanTouchedBreakdown;

  const certificationLabel = jsonData.certification
    ? String(jsonData.certification).toLowerCase()
    : "не выбрано";
  const attestationTheme = `Промежуточная аттестация: ${certificationLabel}`;

  useEffect(() => {
    setData((prev) => {
      const existing = prev[ATTESTATION_ROW_ID];
      return {
        ...prev,
        [ATTESTATION_ROW_ID]: {
          theme: attestationTheme,
          lectures: 0,
          seminars: 0,
          control: existing?.control ?? maxHours.control,
          independent_work: 0,
          competence: "",
          indicator: "",
          results: "",
        },
      };
    });
  }, [attestationTheme, maxHours.control, setData, jsonData?.id]);

  const hoursValidationMessage = useMemo(() => {
    if (
      !(hasMaxHours || manualPlanTouchedTotal || manualPlanTouchedBreakdown)
    ) {
      return "";
    }

    if (hasBreakdownHours || manualPlanTouchedBreakdown) {
      return isHoursEqual(summ, displayMaxHours)
        ? ""
        : "Ошибка заполнения данных. Данные по часам не совпадают";
    }

    return toNumberSafe(summ.all) === toNumberSafe(displayMaxHours.all)
      ? ""
      : "Ошибка заполнения данных. Общее количество часов не совпадает";
  }, [
    hasMaxHours,
    manualPlanTouchedTotal,
    manualPlanTouchedBreakdown,
    hasBreakdownHours,
    summ,
    displayMaxHours,
  ]);

  const handleAddRow = () => {
    const newId = nextId;
    setNextId((prev) => prev + 1);
    setData((prev) => ({
      ...prev,
      [String(newId)]: {
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

  const handleValueChange = (
    rowId: string,
    key: EditableRowKey,
    value: string | number | null
  ) => {
    setData((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [key]: value,
      },
    }));
  };

  const renderPlanInput = (
    value: number,
    onChange: (next: number) => void,
    touched: boolean,
    editable: boolean
  ) => {
    if (!editable) {
      if (!hasMaxHours && !manualPlanEnabled) return "—";
      return value;
    }

    const displayValue = !touched && value === 0 ? "" : value;

    return (
      <TextField
        variant="outlined"
        type="number"
        value={displayValue}
        placeholder="—"
        onChange={(e) => onChange(toNumberSafe(e.target.value))}
        sx={{
          minWidth: 64,
          "& .MuiInputBase-input": {
            textAlign: "center",
            fontSize: "14px !important",
            padding: "4px 6px",
          },
          "& .MuiInputBase-root": {
            alignItems: "center",
            borderRadius: 0,
          },
          "& .MuiOutlinedInput-root": {
            borderRadius: 0,
            "& fieldset": { border: "none" },
            padding: 0,
          },
        }}
        slotProps={{
          input: {
            inputProps: {
              min: 0,
            },
          },
        }}
      />
    );
  };

  const saveData = async () => {
    if (!jsonData.id) return;

    const filteredData = Object.entries(data).reduce(
      (acc: DisciplineContentData, [key, value]) => {
        if (
          value.theme ||
          value.lectures ||
          value.seminars ||
          value.control ||
          value.independent_work
        ) {
          acc[key] = value;
        }
        return acc;
      },
      {}
    );

    let nextStudyLoad: StudyLoadSaveItem[] | null = null;
    if (
      manualPlanEnabled &&
      (manualPlanTouchedTotal || manualPlanTouchedBreakdown)
    ) {
      const plannedLectures = manualPlanNumeric.lectures;
      const plannedSeminars = manualPlanNumeric.seminars;
      const plannedControl = manualPlanNumeric.control;
      const plannedIndependent = manualPlanNumeric.independent_work;
      const computedTotal =
        plannedLectures + plannedSeminars + plannedControl + plannedIndependent;
      const plannedTotal = manualPlanTouchedTotal
        ? manualPlanNumeric.all
        : computedTotal;

      nextStudyLoad = manualPlanTouchedBreakdown
        ? [
            { name: "Всего", id: String(plannedTotal) },
            { name: "Лекции", id: String(plannedLectures) },
            { name: "Практические", id: String(plannedSeminars) },
            { name: "Контроль", id: String(plannedControl) },
            { name: "СРС", id: String(plannedIndependent) },
          ]
        : [{ name: "Всего", id: String(plannedTotal) }];
    }

    try {
      await saveDisciplineContent({
        templateId: jsonData.id,
        content: filteredData,
        studyLoad: nextStudyLoad,
      });

      updateJsonData("content", filteredData);
      if (nextStudyLoad) {
        updateJsonData("study_load", nextStudyLoad);
        setManualPlanTouchedTotal(false);
        setManualPlanTouchedBreakdown(false);
      }
      setData(filteredData);
      showSuccessMessage("Данные успешно сохранены");
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
            aria-label="simple table"
            size="small"
            className="table"
          >
            <TableHead>
              <DisciplineContentTableHeader />
            </TableHead>
            <TableBody>
              {rowIds.map((rowId) => {
                const row = data[rowId];
                if (!row) return null;

                return (
                  <DisciplineContentDataRow
                    key={rowId}
                    rowId={rowId}
                    row={row}
                    readOnly={readOnly}
                    attestationTheme={attestationTheme}
                    onValueChange={handleValueChange}
                  />
                );
              })}

              <TableRow>
                <TableCell>Итого за семестр / курс</TableCell>
                <TableCell
                  sx={getValidationCellSx(
                    summ.all,
                    displayMaxHours.all,
                    true,
                    canCompareTotal
                  )}
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <span>{summ.all}</span>
                    <span>/</span>
                    {manualPlanEnabled
                      ? renderPlanInput(
                          manualPlanNumeric.all,
                          (next) => {
                            setManualPlan((prev: ObjectHours) => ({
                              ...prev,
                              all: next,
                            }));
                            setManualPlanTouchedTotal(true);
                          },
                          manualPlanTouchedTotal,
                          !readOnly
                        )
                      : hasMaxHours
                        ? maxHours.all
                        : "—"}
                  </Box>
                </TableCell>
                <TableCell
                  sx={getValidationCellSx(
                    summ.lectures,
                    displayMaxHours.lectures,
                    canCompareBreakdown,
                    canCompareBreakdown
                  )}
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <span>{summ.lectures}</span>
                    <span>/</span>
                    {manualPlanEnabled
                      ? renderPlanInput(
                          manualPlanNumeric.lectures,
                          (next) => {
                            setManualPlan((prev: ObjectHours) => ({
                              ...prev,
                              lectures: next,
                            }));
                            setManualPlanTouchedBreakdown(true);
                          },
                          manualPlanTouchedBreakdown,
                          !readOnly
                        )
                      : hasMaxHours && hasBreakdownHours
                        ? maxHours.lectures
                        : "—"}
                  </Box>
                </TableCell>
                <TableCell
                  sx={getValidationCellSx(
                    summ.seminars,
                    displayMaxHours.seminars,
                    canCompareBreakdown,
                    canCompareBreakdown
                  )}
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <span>{summ.seminars}</span>
                    <span>/</span>
                    {manualPlanEnabled
                      ? renderPlanInput(
                          manualPlanNumeric.seminars,
                          (next) => {
                            setManualPlan((prev: ObjectHours) => ({
                              ...prev,
                              seminars: next,
                            }));
                            setManualPlanTouchedBreakdown(true);
                          },
                          manualPlanTouchedBreakdown,
                          !readOnly
                        )
                      : hasMaxHours && hasBreakdownHours
                        ? maxHours.seminars
                        : "—"}
                  </Box>
                </TableCell>
                <TableCell
                  sx={getValidationCellSx(
                    summ.control,
                    displayMaxHours.control,
                    canCompareBreakdown,
                    canCompareBreakdown
                  )}
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <span>{summ.control}</span>
                    <span>/</span>
                    {manualPlanEnabled
                      ? renderPlanInput(
                          manualPlanNumeric.control,
                          (next) => {
                            setManualPlan((prev: ObjectHours) => ({
                              ...prev,
                              control: next,
                            }));
                            setManualPlanTouchedBreakdown(true);
                          },
                          manualPlanTouchedBreakdown,
                          !readOnly
                        )
                      : hasMaxHours && hasBreakdownHours
                        ? maxHours.control
                        : "—"}
                  </Box>
                </TableCell>
                <TableCell
                  sx={getValidationCellSx(
                    summ.lect_and_sems,
                    displayMaxHours.lect_and_sems,
                    canCompareBreakdown,
                    canCompareBreakdown
                  )}
                >
                  {summ.lect_and_sems} /{" "}
                  {manualPlanEnabled
                    ? displayMaxHours.lect_and_sems
                    : hasMaxHours && hasBreakdownHours
                      ? maxHours.lect_and_sems
                      : "—"}
                </TableCell>
                <TableCell
                  sx={getValidationCellSx(
                    summ.independent_work,
                    displayMaxHours.independent_work,
                    canCompareBreakdown,
                    canCompareBreakdown
                  )}
                >
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <span>{summ.independent_work}</span>
                    <span>/</span>
                    {manualPlanEnabled
                      ? renderPlanInput(
                          manualPlanNumeric.independent_work,
                          (next) => {
                            setManualPlan((prev: ObjectHours) => ({
                              ...prev,
                              independent_work: next,
                            }));
                            setManualPlanTouchedBreakdown(true);
                          },
                          manualPlanTouchedBreakdown,
                          !readOnly
                        )
                      : hasMaxHours && hasBreakdownHours
                        ? maxHours.independent_work
                        : "—"}
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {!readOnly && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              right: 8,
            }}
          >
            <ExportFromTemplates
              elementName={"content"}
              setChangeableValue={(value) =>
                setData(value as DisciplineContentData)
              }
            />
          </Box>
        )}
      </Box>

      {!readOnly && hoursValidationMessage && (
        <Box sx={{ pb: 1, color: "error.main", fontWeight: 600 }}>
          {hoursValidationMessage}
        </Box>
      )}

      {!readOnly && (
        <ButtonGroup variant="outlined" aria-label="Basic button group">
          <Button onClick={handleAddRow}>Добавить строку</Button>
          <Button variant="contained" onClick={saveData}>
            Сохранить изменения
          </Button>
        </ButtonGroup>
      )}
    </Box>
  );
}
