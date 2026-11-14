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
import type { ObjectHours } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { useDisciplineContentData } from "@pages/teacher-interface/model/useDisciplineContentData";
import { ATTESTATION_ROW_ID } from "@pages/teacher-interface/lib/contentDraft";
import {
  describeHoursMismatches,
  hoursMismatches,
  isComparableHour,
  sumContentHours,
} from "@pages/teacher-interface/lib/hours";
import { useTemplateSync, useTemplateWorkflow } from "@entities/template";
import { useStore } from "@shared/hooks";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";
import { ExportFromTemplates } from "./ExportFromTemplates";
import type { ContentTableType } from "./discipline-content-table/types";
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
export function DisciplineContentTable({
  readOnly = false,
  canEditPlan = false,
  tableData,
}: ContentTableType) {
  const theme = useTheme();
  const jsonData = useStore((state) => state.jsonData);
  const role = useAuth((state) => state.userRole);
  const workflow = useTemplateWorkflow(readOnly ? undefined : jsonData.id);
  const pending = useTemplateSync((state) => state.pending);
  const tableDirty = useTemplateSync((state) =>
    Boolean(state.dirty.content || state.dirty.study_load)
  );
  const enabled =
    !readOnly &&
    Boolean(jsonData.id) &&
    !jsonData.removed_at &&
    !["ready", "closed"].includes(
      String(jsonData.current_status ?? jsonData.status ?? "")
    ) &&
    [UserRole.TEACHER, UserRole.ROP, UserRole.ADMIN].includes(role);
  const canEdit = canEditPlan && enabled && role !== UserRole.TEACHER;
  const editor = useDisciplineContentData({
    tableData,
    enabled,
    canEditPlan: canEdit,
  });
  const { data, displayedPlan, touched, attestationTheme } = editor;
  const summ = sumContentHours(data);
  const rowIds = [
    ...Object.keys(data).filter((id) => id !== ATTESTATION_ROW_ID),
    ATTESTATION_ROW_ID,
  ].filter((id) => Boolean(data[id]));
  const canClearControl =
    editor.editing &&
    (role === UserRole.ROP || role === UserRole.ADMIN) &&
    Boolean(workflow.data?.canEditTeachers);
  const mismatches = hoursMismatches(summ, displayedPlan, touched);

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
                  readOnly={!editor.editing || editor.saving}
                  attestationTheme={attestationTheme}
                  onValueChange={editor.changeRow}
                  onClearControl={
                    canClearControl
                      ? () => editor.changeRow(rowId, "control", 0)
                      : undefined
                  }
                  clearDisabled={editor.saving}
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
                    touched
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
                        {editor.editing && canEdit && editable ? (
                          <TextField
                            type="number"
                            variant="outlined"
                            size="small"
                            value={comparable || planned !== 0 ? planned : ""}
                            placeholder="—"
                            disabled={editor.saving}
                            onChange={(event) =>
                              editor.changePlan(
                                key as Exclude<keyof ObjectHours, "contact">,
                                event.target.value === ""
                                  ? 0
                                  : Number(event.target.value)
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
      {editor.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {editor.error}
        </Alert>
      )}
      {!readOnly && (
        <Box
          role="group"
          aria-label="Редактирование содержания дисциплины"
          sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
        >
          {editor.editing ? (
            <>
              <Button
                variant="contained"
                disabled={editor.saving}
                onClick={() => void editor.save()}
              >
                Сохранить
              </Button>
              <Button
                disabled={editor.saving}
                onClick={() => void editor.cancel()}
              >
                Отмена
              </Button>
              <Button
                startIcon={<AddIcon />}
                disabled={editor.saving}
                onClick={editor.addRow}
              >
                Добавить строку
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                startIcon={<EditOutlinedIcon />}
                disabled={!enabled || pending > 0 || tableDirty}
                onClick={editor.edit}
              >
                Редактировать
              </Button>
              <ExportFromTemplates
                elementName="content"
                disabled={!enabled || pending > 0 || tableDirty}
              />
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
