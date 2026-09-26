import { InfoOutlined } from "@mui/icons-material";
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
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
  hoursMatchPlan,
  isComparableHour,
  parseHours,
} from "@pages/teacher-interface/lib/hours";
import {
  saveDisciplineContent,
  saveStudyPlan,
} from "@pages/teacher-interface/api/studyPlan";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
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
const helpText = `Контактная работа = Лекции + Практические занятия (включая лабораторные). Всего = Контактная работа + Самостоятельная работа + Контроль. Контроль — часы промежуточной аттестации, вносятся в строку аттестации. Слева — сумма по темам, считается автоматически. Справа — данные учебного плана 1С: их меняют только РОП и администратор. Красный — сумма не совпадает с учебным планом, зелёный — совпадает. Сохранить можно и при расхождении.`;

export function DisciplineContentTable({
  readOnly = false,
  canEditPlan = false,
  tableData,
}: ContentTableType) {
  const theme = useTheme();
  const jsonData = useStore((state) => state.jsonData);
  const updateJsonData = useStore((state) => state.updateJsonData);
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
  const hasMismatch = !hoursMatchPlan(summ, displayedPlan, manual.touched);
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
    setData((previous) => ({
      ...previous,
      [rowId]: { ...previous[rowId], [key]: value },
    }));
  };
  const addRow = () => {
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
  const save = async () => {
    if (!jsonData.id) return;
    const content = Object.fromEntries(
      Object.entries(data).filter(
        ([, row]) =>
          row.theme ||
          row.lectures ||
          row.seminars ||
          row.control ||
          row.independent_work
      )
    ) as DisciplineContentData;
    try {
      await saveDisciplineContent(jsonData.id, content);
      updateJsonData("content", content);
      if (canEdit && Object.keys(manual.patch).length) {
        const updated = await saveStudyPlan(jsonData.id, {
          hours: manual.patch,
        });
        updateJsonData("study_load", updated.study_load);
        updateJsonData("zet", updated.zet);
        updateJsonData("study_plan_hours", updated.study_plan_hours);
        manual.reset();
      }
      setData(content);
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
            size="small"
            aria-label="Содержание дисциплины"
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
                />
              ))}
              <TableRow>
                <TableCell>
                  Итого за семестр / курс{" "}
                  <Tooltip title={helpText}>
                    <IconButton
                      size="small"
                      aria-label="Правила заполнения таблицы"
                    >
                      <InfoOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
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
                        comparable
                          ? {
                              color: matches ? "success.main" : "error.main",
                              backgroundColor: matches
                                ? undefined
                                : alpha(theme.palette.error.main, 0.08),
                            }
                          : { color: "text.secondary" }
                      }
                    >
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
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
                            onChange={(event) =>
                              manual.change(
                                key as Exclude<keyof ObjectHours, "contact">,
                                parseHours(event.target.value)
                              )
                            }
                            slotProps={{ htmlInput: { min: 0 } }}
                            sx={{
                              width: 70,
                              "& input": { textAlign: "center", p: 0.5 },
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
      {!readOnly && hasMismatch && (
        <Box sx={{ color: "error.main", fontWeight: "bold", mb: 2 }}>
          Ошибка заполнения данных. Данные по часам не совпадают
        </Box>
      )}
      {!readOnly && (
        <ButtonGroup variant="outlined">
          <Button onClick={addRow}>Добавить строку</Button>
          <Button variant="contained" onClick={save}>
            Сохранить изменения
          </Button>
        </ButtonGroup>
      )}
    </Box>
  );
}
