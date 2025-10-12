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
} from "@mui/material";
import { DisciplineContentData, ObjectHours } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useEffect, useState } from "react";
import EditableCell from "./EditableCell";
import { EditableNumber } from "./EditableNumber";
import { ExportFromTemplates } from "./ExportFromTemplates";

type ContentTableType = {
  tableData?: DisciplineContentData;
  readOnly?: boolean;
};

interface StudyLoad {
  id: string;
  name: string;
}

export function DisciplineContentTable({ readOnly = false, tableData }: ContentTableType) {
  const jsonData = useStore.getState().jsonData;
  const dataHours: StudyLoad[] = jsonData?.study_load || [];
  const { updateJsonData } = useStore();
  const initialData = jsonData?.content as DisciplineContentData | undefined;
  const initialDataLength = initialData ? Object.keys(initialData).length : 0;
  const [nextId, setNextId] = useState<number>(initialDataLength);

  const [data, setData] = useState<DisciplineContentData>(
    tableData ||
      initialData || {
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

  const maxHours: ObjectHours = (Array.isArray(dataHours) ? dataHours : []).reduce(
    (acc, item) => {
      const hours = parseFloat(item.id);

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
      lect_and_sems: 0,
      independent_work: 0,
    }
  );

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
          all += Number(row.lectures) + Number(row.seminars) + Number(row.independent_work);
          lectures += Number(row.lectures);
          seminars += Number(row.seminars);
          lect_and_sems += Number(row.lectures) + Number(row.seminars);
          independent_work += Number(row.independent_work);
        });

        setSumm({
          all: all,
          lectures: lectures,
          seminars: seminars,
          lect_and_sems: lect_and_sems,
          independent_work: independent_work,
        });
      }
    };

    summHours();
  }, [data]);

  const validateHours = (hours: number, maxHours: number) => {
    if (Number(hours) !== Number(maxHours)) return "red";
    return "green";
  };

  const saveData = async () => {
    if (!data) return;
    if (!compareObjects(summ, maxHours)) {
      showErrorMessage("Ошибка заполнения данных. Данные по часам не совпадают");
      return;
    }
    const id = useStore.getState().jsonData.id;

    const filteredData = Object.entries(data).reduce((acc: DisciplineContentData, [key, value]) => {
      if (value.theme || value.lectures || value.seminars || value.independent_work) {
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
    setNextId(nextId + 1);
    const newData = {
      ...data,
      [nextId]: {
        theme: "",
        lectures: "",
        seminars: "",
        independent_work: "",
      },
    };
    setData(newData);
  };

  const handleValueChange = (id: number, key: string, value: string | number) => {
    if (!data || !setData) return;

    const newData = {
      ...data,
      [id]: {
        ...data[id],
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
                Object.keys(data).map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <EditableCell
                        value={data[row].theme}
                        onValueChange={(value: string) => handleValueChange(index, "theme", value)}
                        readOnly={readOnly}
                      />
                    </TableCell>
                    <TableCell
                      style={{
                        alignContent: "center",
                        textAlign: "center",
                      }}
                    >
                      {data[row].lectures + data[row].seminars + data[row].independent_work}
                    </TableCell>
                    <TableCell>
                      <EditableNumber
                        value={data[row].lectures}
                        onValueChange={(value: number) => handleValueChange(index, "lectures", value)}
                        readOnly={readOnly}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableNumber
                        value={data[row].seminars}
                        onValueChange={(value: number) => handleValueChange(index, "seminars", value)}
                        readOnly={readOnly}
                      />
                    </TableCell>
                    <TableCell
                      style={{
                        alignContent: "center",
                        textAlign: "center",
                      }}
                    >
                      {data[row].lectures + data[row].seminars}
                    </TableCell>
                    <TableCell>
                      <EditableNumber
                        value={data[row].independent_work}
                        onValueChange={(value: number) => handleValueChange(index, "independent_work", value)}
                        readOnly={readOnly}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              <TableRow>
                <TableCell>Итого за семестр / курс</TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.all, maxHours.all),
                  }}
                >
                  {summ.all} / {maxHours.all}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.lectures, maxHours.lectures),
                  }}
                >
                  {summ.lectures} / {maxHours.lectures}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.seminars, maxHours.seminars),
                  }}
                >
                  {summ.seminars} / {maxHours.seminars}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.lect_and_sems, maxHours.lect_and_sems),
                  }}
                >
                  {summ.lect_and_sems} / {maxHours.lect_and_sems}
                </TableCell>
                <TableCell
                  sx={{
                    color: validateHours(summ.independent_work, maxHours.independent_work),
                  }}
                >
                  {summ.independent_work} / {maxHours.independent_work}
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
            <ExportFromTemplates elementName={"content"} setChangeableValue={setData} />
          </Box>
        )}
      </Box>

      {!readOnly && (
        <ButtonGroup variant="outlined" aria-label="Basic button group" size="small">
          <Button onClick={handleAddRow}>Добавить строку</Button>
          <Button variant="contained" onClick={saveData}>
            Сохранить изменения
          </Button>
        </ButtonGroup>
      )}
    </Box>
  );
}
