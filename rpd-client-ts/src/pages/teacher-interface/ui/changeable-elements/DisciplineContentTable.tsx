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
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditableTableCell } from "./EditableTableCell";
import { ExportFromTemplates } from "./ExportFromTemplates";

type ContentTableType = {
  tableData?: DisciplineContentData;
  readOnly?: boolean;
};

interface StudyLoad {
  id: string;
  name: string;
}

const ATTESTATION_ROW_ID = "__attestation__";
const TOTAL_LABELS = ["всего", "итого"];
const LECTURES_LABELS = ["лекц"];
const SEMINARS_LABELS = ["практич", "семинар", "лаб"];
const INDEPENDENT_LABELS = ["срс", "самостоят"];
const CONTROL_LABELS = ["контрол", "экзам", "зач", "аттест"];

type StudyLoadCategory =
  | "total"
  | "lectures"
  | "seminars"
  | "independent"
  | "control"
  | "unknown";
type DisciplineContentRow = DisciplineContentData[string];

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

function toNumberSafe(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
    const fallback = parseFloat(normalized);
    return Number.isFinite(fallback) ? fallback : 0;
  }
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function getStudyLoadCategory(label: string): StudyLoadCategory {
  if (!label) return "unknown";
  if (includesAny(label, TOTAL_LABELS)) return "total";
  if (includesAny(label, LECTURES_LABELS)) return "lectures";
  if (includesAny(label, SEMINARS_LABELS)) return "seminars";
  if (includesAny(label, INDEPENDENT_LABELS)) return "independent";
  if (includesAny(label, CONTROL_LABELS)) return "control";
  return "unknown";
}

function getRowHours(row: DisciplineContentRow) {
  const lectures = toNumberSafe(row.lectures);
  const seminars = toNumberSafe(row.seminars);
  const control = toNumberSafe(row.control);
  const independent = toNumberSafe(row.independent_work);
  const contact = lectures + seminars + control;
  const total = contact + independent;
  return { lectures, seminars, control, independent, contact, total };
}

function normalizeStudyLoad(studyLoad: unknown): StudyLoad[] {
  if (!studyLoad) return [];

  if (Array.isArray(studyLoad)) {
    return studyLoad
      .map((item) => {
        const rec =
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : {};
        const name =
          getRecordValue(rec, "name") ??
          getRecordValue(rec, "type") ??
          getRecordValue(rec, "title");
        const id =
          getRecordValue(rec, "id") ??
          getRecordValue(rec, "hours") ??
          getRecordValue(rec, "value");
        return {
          name: name !== undefined ? String(name) : "",
          id: id !== undefined ? String(id) : "",
        };
      })
      .filter((x) => x.name || x.id);
  }

  if (typeof studyLoad === "object") {
    return Object.entries(studyLoad as Record<string, unknown>)
      .map(([name, val]) => {
        if (val && typeof val === "object") {
          const v = val as Record<string, unknown>;
          const hours =
            getRecordValue(v, "id") ??
            getRecordValue(v, "hours") ??
            getRecordValue(v, "value");
          return {
            name: String(name),
            id: hours !== undefined ? String(hours) : "",
          };
        }
        return { name: String(name), id: val !== undefined ? String(val) : "" };
      })
      .filter((x) => x.name || x.id);
  }

  return [];
}

export function DisciplineContentTable({
  readOnly = false,
  tableData,
}: ContentTableType) {
  const jsonData = useStore((state) => state.jsonData);
  const dataHours = useMemo(
    () => normalizeStudyLoad(jsonData?.study_load),
    [jsonData?.study_load]
  );
  const hasMaxHours = dataHours.length > 0;
  const { maxHoursBase, hasBreakdownHours } = useMemo(() => {
    const empty: ObjectHours = {
      all: 0,
      lectures: 0,
      seminars: 0,
      control: 0,
      lect_and_sems: 0,
      independent_work: 0,
    };

    if (!dataHours.length)
      return { maxHoursBase: empty, hasBreakdownHours: false };

    let sumAll = 0;
    let explicitTotal: number | null = null;
    let hasBreakdown = false;
    let hasControl = false;
    const base = { ...empty };

    for (const item of dataHours) {
      const hours = toNumberSafe(item.id);
      sumAll += hours;
      const label = normalizeLabel(item.name);
      const category = getStudyLoadCategory(label);

      switch (category) {
        case "total":
          explicitTotal = hours;
          break;
        case "lectures":
          base.lectures += hours;
          hasBreakdown = true;
          break;
        case "seminars":
          base.seminars += hours;
          hasBreakdown = true;
          break;
        case "independent":
          base.independent_work += hours;
          hasBreakdown = true;
          break;
        case "control":
          base.control += hours;
          hasBreakdown = true;
          hasControl = true;
          break;
        default:
          break;
      }
    }

    base.all = explicitTotal ?? sumAll;

    if (!hasControl && hasBreakdown) {
      base.control = Math.max(
        0,
        base.all - (base.lectures + base.seminars + base.independent_work)
      );
    }

    base.lect_and_sems = base.lectures + base.seminars + base.control;

    return { maxHoursBase: base, hasBreakdownHours: hasBreakdown };
  }, [dataHours]);
  const updateJsonData = useStore((state) => state.updateJsonData);

  const storeData = jsonData?.content as DisciplineContentData | undefined;

  const getNextIdFromData = useCallback(
    (content: DisciplineContentData | undefined) => {
      if (!content) return 0;
      const numericKeys = Object.keys(content)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n));
      const maxKey = numericKeys.length ? Math.max(...numericKeys) : -1;
      return maxKey + 1;
    },
    []
  );

  const getInitialData = useCallback((): DisciplineContentData => {
    return (
      tableData ||
      storeData || {
        "0": {
          theme: "",
          lectures: 0,
          seminars: 0,
          independent_work: 0,
          competence: "",
          indicator: "",
          results: "",
        },
      }
    );
  }, [storeData, tableData]);

  const [nextId, setNextId] = useState<number>(() =>
    getNextIdFromData(getInitialData())
  );

  const [data, setData] = useState<DisciplineContentData>(() =>
    getInitialData()
  );

  useEffect(() => {
    const nextData = getInitialData();
    setData(nextData);
    setNextId(getNextIdFromData(nextData));
  }, [getInitialData, getNextIdFromData, jsonData?.id]);

  const maxHours: ObjectHours = useMemo(() => {
    if (!hasBreakdownHours) {
      return {
        all: Number(maxHoursBase.all),
        lectures: 0,
        seminars: 0,
        control: 0,
        lect_and_sems: 0,
        independent_work: 0,
      };
    }

    return {
      ...maxHoursBase,
      control: Number(maxHoursBase.control),
      lect_and_sems:
        Number(maxHoursBase.lectures) +
        Number(maxHoursBase.seminars) +
        Number(maxHoursBase.control),
    };
  }, [hasBreakdownHours, maxHoursBase]);

  const manualPlanEnabled = !readOnly;
  const [manualPlan, setManualPlan] = useState<ObjectHours>(() => maxHours);
  const [manualPlanTouchedTotal, setManualPlanTouchedTotal] = useState(false);
  const [manualPlanTouchedBreakdown, setManualPlanTouchedBreakdown] =
    useState(false);

  useEffect(() => {
    if (!manualPlanEnabled) {
      setManualPlan(maxHours);
      setManualPlanTouchedTotal(false);
      setManualPlanTouchedBreakdown(false);
      return;
    }
    if (!manualPlanTouchedTotal && !manualPlanTouchedBreakdown) {
      setManualPlan(maxHours);
    }
  }, [
    manualPlanEnabled,
    maxHours,
    manualPlanTouchedTotal,
    manualPlanTouchedBreakdown,
  ]);

  useEffect(() => {
    setManualPlanTouchedTotal(false);
    setManualPlanTouchedBreakdown(false);
    setManualPlan(maxHours);
  }, [jsonData?.id]);

  const manualPlanNumeric = useMemo(() => {
    const lectures = toNumberSafe(manualPlan.lectures);
    const seminars = toNumberSafe(manualPlan.seminars);
    const control = toNumberSafe(manualPlan.control);
    const independent = toNumberSafe(manualPlan.independent_work);
    const total = toNumberSafe(manualPlan.all);
    return {
      all: total,
      lectures,
      seminars,
      control,
      independent_work: independent,
      lect_and_sems: lectures + seminars + control,
    };
  }, [manualPlan]);

  const displayMaxHours = manualPlanEnabled ? manualPlanNumeric : maxHours;
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
  }, [jsonData?.id, attestationTheme, maxHours.control]);

  function compareObjects(object1: ObjectHours, object2: ObjectHours) {
    const keys = Object.keys(object1) as (keyof ObjectHours)[];

    if (keys.length !== Object.keys(object2).length) return false;

    for (const key of keys) {
      if (toNumberSafe(object1[key]) !== toNumberSafe(object2[key]))
        return false;
    }

    return true;
  }

  const [summ, setSumm] = useState<ObjectHours>({
    all: 0,
    lectures: 0,
    seminars: 0,
    control: 0,
    lect_and_sems: 0,
    independent_work: 0,
  });

  useEffect(() => {
    const summHours = () => {
      let all = 0;
      let lectures = 0;
      let seminars = 0;
      let lect_and_sems = 0;
      let independent_work = 0;
      let control = 0;

      if (data) {
        Object.keys(data).forEach((key) => {
          const row = data[key];
          const rowHours = getRowHours(row);
          all += rowHours.total;
          lectures += rowHours.lectures;
          seminars += rowHours.seminars;
          control += rowHours.control;
          lect_and_sems += rowHours.contact;
          independent_work += rowHours.independent;
        });

        setSumm({
          all: all,
          lectures: lectures,
          seminars: seminars,
          control: control,
          lect_and_sems: lect_and_sems,
          independent_work: independent_work,
        });
      }
    };

    summHours();
  }, [data]);

  const validateHours = (
    hours: number,
    maxHours: number,
    isComparable: boolean,
    hasComparableMax: boolean
  ) => {
    if (!hasComparableMax) return "grey";
    if (!isComparable) return "grey";
    if (toNumberSafe(hours) !== toNumberSafe(maxHours)) return "red";
    return "green";
  };

  const saveData = async () => {
    if (!data) return;
    if (hasMaxHours || manualPlanTouchedTotal || manualPlanTouchedBreakdown) {
      if (hasBreakdownHours || manualPlanTouchedBreakdown) {
        if (!compareObjects(summ, displayMaxHours)) {
          showErrorMessage(
            "Ошибка заполнения данных. Данные по часам не совпадают"
          );
          return;
        }
      } else if (manualPlanTouchedTotal || hasMaxHours) {
        if (toNumberSafe(summ.all) !== toNumberSafe(displayMaxHours.all)) {
          showErrorMessage(
            "Ошибка заполнения данных. Общее количество часов не совпадает"
          );
          return;
        }
      }
    }
    const id = jsonData.id;

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

    try {
      let nextStudyLoad: Array<{ name: string; id: string }> | null = null;
      const requests = [
        axiosBase.put(`update-json-value/${id}`, {
          fieldToUpdate: "content",
          value: filteredData,
        }),
      ];

      if (
        manualPlanEnabled &&
        (manualPlanTouchedTotal || manualPlanTouchedBreakdown)
      ) {
        const plannedLectures = manualPlanNumeric.lectures;
        const plannedSeminars = manualPlanNumeric.seminars;
        const plannedControl = manualPlanNumeric.control;
        const plannedIndependent = manualPlanNumeric.independent_work;
        const computedTotal =
          plannedLectures +
          plannedSeminars +
          plannedControl +
          plannedIndependent;
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

        requests.push(
          axiosBase.put(`update-json-value/${id}`, {
            fieldToUpdate: "study_load",
            value: nextStudyLoad,
          })
        );
        setManualPlanTouchedTotal(false);
        setManualPlanTouchedBreakdown(false);
      }

      await Promise.all(requests);

      updateJsonData("content", filteredData);
      if (nextStudyLoad) {
        updateJsonData("study_load", nextStudyLoad);
      }
      setData(filteredData);
      showSuccessMessage("Данные успешно сохранены");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      console.error(error);
    }
  };

  const handleAddRow = () => {
    const newId = nextId;
    setNextId(newId + 1);
    const newData = {
      ...data,
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
    };
    setData(newData);
  };

  const handleValueChange = (
    rowId: string,
    key: string,
    value: string | number
  ) => {
    if (!data || !setData) return;
    // const formattedValue = value === 0 ? value

    const newData = {
      ...data,
      [rowId]: {
        ...data[rowId],
        [key]: value,
      },
    };
    setData(newData);
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
              <TableRow>
                <TableCell align="center" width="180px">
                  Наименование разделов и тем дисциплины
                </TableCell>
                <TableCell align="center" width="90px" sx={{ minWidth: 90 }}>
                  Всего (академ. часы)
                </TableCell>
                <TableCell align="center" width="90px" sx={{ minWidth: 90 }}>
                  Лекции
                </TableCell>
                <TableCell align="center" width="140px" sx={{ minWidth: 140 }}>
                  Практические (семинарские) занятия
                </TableCell>
                <TableCell align="center" width="100px" sx={{ minWidth: 100 }}>
                  Контроль
                </TableCell>
                <TableCell align="center" width="130px" sx={{ minWidth: 130 }}>
                  Всего часов контактной работы
                </TableCell>
                <TableCell align="center" width="160px" sx={{ minWidth: 160 }}>
                  Самостоятельная работа обучающегося
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data &&
                [
                  ...Object.keys(data).filter(
                    (id) => id !== ATTESTATION_ROW_ID
                  ),
                  ATTESTATION_ROW_ID,
                ]
                  .filter((id) => Boolean(data[id]))
                  .map((rowId) => {
                    const rowHours = getRowHours(data[rowId]);
                    return (
                      <TableRow key={rowId}>
                        <TableCell
                          padding={"none"}
                          sx={{
                            "& .MuiTableCell-root": {
                              padding: "0px 0px",
                            },
                          }}
                        >
                          {rowId === ATTESTATION_ROW_ID ? (
                            <Box sx={{ fontSize: 14, p: 1, fontWeight: 600 }}>
                              {attestationTheme}
                            </Box>
                          ) : readOnly ? (
                            data[rowId].theme
                          ) : (
                            <TextField
                              sx={{
                                fontSize: "14px !important",
                                "& .MuiInputBase-input": {
                                  fontSize: "14px !important",
                                },
                                "& .MuiOutlinedInput-root": {
                                  borderRadius: 0,
                                  "& fieldset": { border: "none" },
                                  padding: 0,
                                },
                              }}
                              multiline
                              value={data[rowId].theme}
                              onChange={(e) =>
                                handleValueChange(
                                  rowId,
                                  "theme",
                                  e.target.value
                                )
                              }
                              disabled={readOnly}
                              fullWidth
                            />
                          )}
                        </TableCell>
                        <TableCell
                          style={{
                            alignContent: "center",
                            textAlign: "center",
                          }}
                        >
                          {rowHours.total}
                        </TableCell>
                        <EditableTableCell
                          value={data[rowId].lectures}
                          onValueChange={(value: number) =>
                            handleValueChange(rowId, "lectures", value)
                          }
                          readOnly={readOnly}
                        />
                        <EditableTableCell
                          value={data[rowId].seminars}
                          onValueChange={(value: number) =>
                            handleValueChange(rowId, "seminars", value)
                          }
                          readOnly={readOnly}
                        />
                        <EditableTableCell
                          value={data[rowId].control || null}
                          onValueChange={(value: number) =>
                            handleValueChange(rowId, "control", value)
                          }
                          readOnly={readOnly}
                        />
                        <TableCell
                          style={{
                            alignContent: "center",
                            textAlign: "center",
                          }}
                        >
                          {rowHours.contact}
                        </TableCell>
                        <EditableTableCell
                          value={data[rowId].independent_work}
                          onValueChange={(value: number) =>
                            handleValueChange(rowId, "independent_work", value)
                          }
                          readOnly={readOnly}
                        />
                      </TableRow>
                    );
                  })}
              <TableRow>
                <TableCell>Итого за семестр / курс</TableCell>
                <TableCell
                  sx={{
                    color: validateHours(
                      summ.all,
                      displayMaxHours.all,
                      true,
                      canCompareTotal
                    ),
                  }}
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
                            setManualPlan((prev) => ({ ...prev, all: next }));
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
                  sx={{
                    color: validateHours(
                      summ.lectures,
                      displayMaxHours.lectures,
                      canCompareBreakdown,
                      canCompareBreakdown
                    ),
                  }}
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
                            setManualPlan((prev) => ({
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
                  sx={{
                    color: validateHours(
                      summ.seminars,
                      displayMaxHours.seminars,
                      canCompareBreakdown,
                      canCompareBreakdown
                    ),
                  }}
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
                            setManualPlan((prev) => ({
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
                  sx={{
                    color: validateHours(
                      summ.control,
                      displayMaxHours.control,
                      canCompareBreakdown,
                      canCompareBreakdown
                    ),
                  }}
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
                            setManualPlan((prev) => ({
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
                  sx={{
                    color: validateHours(
                      summ.lect_and_sems,
                      displayMaxHours.lect_and_sems,
                      canCompareBreakdown,
                      canCompareBreakdown
                    ),
                  }}
                >
                  {summ.lect_and_sems} /{" "}
                  {manualPlanEnabled
                    ? displayMaxHours.lect_and_sems
                    : hasMaxHours && hasBreakdownHours
                      ? maxHours.lect_and_sems
                      : "—"}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(
                      summ.independent_work,
                      displayMaxHours.independent_work,
                      canCompareBreakdown,
                      canCompareBreakdown
                    ),
                  }}
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
                            setManualPlan((prev) => ({
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
