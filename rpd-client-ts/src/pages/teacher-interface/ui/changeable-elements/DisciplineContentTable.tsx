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
import { DisciplineContentData, ObjectHours } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
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

function getRecordValue(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function normalizeStudyLoad(studyLoad: unknown): StudyLoad[] {
  if (!studyLoad) return [];

  if (Array.isArray(studyLoad)) {
    return studyLoad
      .map((item) => {
        const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const name = getRecordValue(rec, "name") ?? getRecordValue(rec, "type") ?? getRecordValue(rec, "title");
        const id = getRecordValue(rec, "id") ?? getRecordValue(rec, "hours") ?? getRecordValue(rec, "value");
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
          const hours = getRecordValue(v, "id") ?? getRecordValue(v, "hours") ?? getRecordValue(v, "value");
          return { name: String(name), id: hours !== undefined ? String(hours) : "" };
        }
        return { name: String(name), id: val !== undefined ? String(val) : "" };
      })
      .filter((x) => x.name || x.id);
  }

  return [];
}

export function DisciplineContentTable({ readOnly = false, tableData }: ContentTableType) {
  const jsonData = useStore((state) => state.jsonData);
  const dataHours = useMemo(() => normalizeStudyLoad(jsonData?.study_load), [jsonData?.study_load]);
  const hasMaxHours = dataHours.length > 0;
  const hasBreakdownHours = useMemo(() => {
    const breakdown = new Set(["СРС", "Практические", "Лекции"]);
    return dataHours.some((x) => breakdown.has(x.name));
  }, [dataHours]);
  const updateJsonData = useStore((state) => state.updateJsonData);

  const storeData = jsonData?.content as DisciplineContentData | undefined;

  const getNextIdFromData = useCallback((content: DisciplineContentData | undefined) => {
    if (!content) return 0;
    const numericKeys = Object.keys(content)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n));
    const maxKey = numericKeys.length ? Math.max(...numericKeys) : -1;
    return maxKey + 1;
  }, []);

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

  const [nextId, setNextId] = useState<number>(() => getNextIdFromData(getInitialData()));

  const [data, setData] = useState<DisciplineContentData>(() => getInitialData());

  useEffect(() => {
    const nextData = getInitialData();
    setData(nextData);
    setNextId(getNextIdFromData(nextData));
  }, [getInitialData, getNextIdFromData, jsonData?.id]);

  const maxHoursBase = dataHours.reduce(
    (acc, item) => {
      const hours = parseFloat(item.id);
      if (!Number.isFinite(hours)) return acc;

      switch (item.name) {
        case "СРС":
          acc.independent_work += hours;
          break;
        case "Практические":
          acc.seminars += hours;
          acc.lect_and_sems += hours;
          break;
        case "Лекции":
          acc.lectures += hours;
          acc.lect_and_sems += hours;
          break;
        default:
          break;
      }

      acc.all += hours;

      return acc;
    },
    {
      all: 0,
      lectures: 0,
      seminars: 0,
      control: 0,
      lect_and_sems: 0,
      independent_work: 0,
    }
  );

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

    const maxControl = Math.max(
      0,
      Number(maxHoursBase.all) -
        (Number(maxHoursBase.lectures) + Number(maxHoursBase.seminars) + Number(maxHoursBase.independent_work))
    );

    return {
      ...maxHoursBase,
      control: maxControl,
      lect_and_sems: Number(maxHoursBase.lectures) + Number(maxHoursBase.seminars) + maxControl,
    };
  }, [hasBreakdownHours, maxHoursBase]);

  const certificationLabel = jsonData.certification ? String(jsonData.certification).toLowerCase() : "не выбрано";
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
      if (Number(object1[key]) !== Number(object2[key])) return false;
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

      if (data) {
        Object.keys(data).forEach((key) => {
          const row = data[key];
          all += Number(row.lectures) + Number(row.seminars) + Number(row.control || 0) + Number(row.independent_work);
          lectures += Number(row.lectures);
          seminars += Number(row.seminars);
          lect_and_sems += Number(row.lectures) + Number(row.seminars) + Number(row.control || 0);
          independent_work += Number(row.independent_work);
        });

        setSumm({
          all: all,
          lectures: lectures,
          seminars: seminars,
          control: lect_and_sems - (lectures + seminars),
          lect_and_sems: lect_and_sems,
          independent_work: independent_work,
        });
      }
    };

    summHours();
  }, [data]);

  const validateHours = (hours: number, maxHours: number, isComparable: boolean) => {
    if (!hasMaxHours) return "grey";
    if (!isComparable) return "grey";
    if (Number(hours) !== Number(maxHours)) return "red";
    return "green";
  };

  const saveData = async () => {
    if (!data) return;
    if (hasMaxHours) {
      if (hasBreakdownHours) {
        if (!compareObjects(summ, maxHours)) {
          showErrorMessage("Ошибка заполнения данных. Данные по часам не совпадают");
          return;
        }
      } else {
        if (Number(summ.all) !== Number(maxHours.all)) {
          showErrorMessage("Ошибка заполнения данных. Общее количество часов не совпадает");
          return;
        }
      }
    }
    const id = jsonData.id;

    const filteredData = Object.entries(data).reduce((acc: DisciplineContentData, [key, value]) => {
      if (value.theme || value.lectures || value.seminars || value.control || value.independent_work) {
        acc[key] = value;
      }
      return acc;
    }, {});

    try {
      await axiosBase.put(`update-json-value/${id}`, {
        fieldToUpdate: "content",
        value: filteredData,
      });

      updateJsonData("content", filteredData);
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

  const handleValueChange = (rowId: string, key: string, value: string | number) => {
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

  return (
    <Box>
      <Box sx={{ position: "relative", my: 3 }}>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650, mb: 6 }} aria-label="simple table" size="small" className="table">
            <TableHead>
              <TableRow>
                <TableCell align="center" width="180px">
                  Наименование разделов и тем дисциплины
                </TableCell>
                <TableCell align="center" width="70px">
                  Всего (академ. часы)
                </TableCell>
                <TableCell align="center" width="70px">
                  Лекции
                </TableCell>
                <TableCell align="center" width="120px">
                  Практические (семинарские) занятия
                </TableCell>
                <TableCell align="center" width="90px">
                  Контроль
                </TableCell>
                <TableCell align="center" width="100px">
                  Всего часов контактной работы
                </TableCell>
                <TableCell align="center" width="140px">
                  Самостоятельная работа обучающегося
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data &&
                [...Object.keys(data).filter((id) => id !== ATTESTATION_ROW_ID), ATTESTATION_ROW_ID]
                  .filter((id) => Boolean(data[id]))
                  .map((rowId) => (
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
                          <Box sx={{ fontSize: 14, p: 1, fontWeight: 600 }}>{attestationTheme}</Box>
                        ) : readOnly ? (
                          data[rowId].theme
                        ) : (
                          <TextField
                            sx={{
                              fontSize: "14px !important",
                              "& .MuiInputBase-input": { fontSize: "14px !important" },
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 0,
                                "& fieldset": { border: "none" },
                                padding: 0,
                              },
                            }}
                            multiline
                            value={data[rowId].theme}
                            onChange={(e) => handleValueChange(rowId, "theme", e.target.value)}
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
                        {Number(data[rowId].lectures) +
                          Number(data[rowId].seminars) +
                          Number(data[rowId].control || 0) +
                          Number(data[rowId].independent_work)}
                      </TableCell>
                      <EditableTableCell
                        value={data[rowId].lectures}
                        onValueChange={(value: number) => handleValueChange(rowId, "lectures", value)}
                        readOnly={readOnly}
                      />
                      <EditableTableCell
                        value={data[rowId].seminars}
                        onValueChange={(value: number) => handleValueChange(rowId, "seminars", value)}
                        readOnly={readOnly}
                      />
                      <EditableTableCell
                        value={data[rowId].control || null}
                        onValueChange={(value: number) => handleValueChange(rowId, "control", value)}
                        readOnly={readOnly}
                      />
                      <TableCell
                        style={{
                          alignContent: "center",
                          textAlign: "center",
                        }}
                      >
                        {Number(data[rowId].lectures) + Number(data[rowId].seminars) + Number(data[rowId].control || 0)}
                      </TableCell>
                      <EditableTableCell
                        value={data[rowId].independent_work}
                        onValueChange={(value: number) => handleValueChange(rowId, "independent_work", value)}
                        readOnly={readOnly}
                      />
                    </TableRow>
                  ))}
              <TableRow>
                <TableCell>Итого за семестр / курс</TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.all, maxHours.all, true),
                  }}
                >
                  {summ.all} / {hasMaxHours ? maxHours.all : "—"}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.lectures, maxHours.lectures, hasBreakdownHours),
                  }}
                >
                  {summ.lectures} / {hasMaxHours && hasBreakdownHours ? maxHours.lectures : "—"}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.seminars, maxHours.seminars, hasBreakdownHours),
                  }}
                >
                  {summ.seminars} / {hasMaxHours && hasBreakdownHours ? maxHours.seminars : "—"}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.control, maxHours.control, hasBreakdownHours),
                  }}
                >
                  {summ.control} / {hasMaxHours && hasBreakdownHours ? maxHours.control : "—"}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.lect_and_sems, maxHours.lect_and_sems, hasBreakdownHours),
                  }}
                >
                  {summ.lect_and_sems} / {hasMaxHours && hasBreakdownHours ? maxHours.lect_and_sems : "—"}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.independent_work, maxHours.independent_work, hasBreakdownHours),
                  }}
                >
                  {summ.independent_work} / {hasMaxHours && hasBreakdownHours ? maxHours.independent_work : "—"}
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
              setChangeableValue={(value) => setData(value as DisciplineContentData)}
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
