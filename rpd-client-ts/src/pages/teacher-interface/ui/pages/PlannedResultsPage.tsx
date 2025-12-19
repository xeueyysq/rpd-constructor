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
  Tooltip,
} from "@mui/material";
import { PlannedResultsData, Results } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { parseCsvToJson, ParsedPlannedResults } from "@shared/ability/lib/parseCsvToJson.ts";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Loader } from "@shared/ui";
import { isAxiosError } from "axios";
import { FC, useEffect, useState } from "react";
import { EditableCell } from "../changeable-elements/EditableCell.tsx";
import { PageTitle } from "@shared/ui";

const PlannedResultsPage: FC = () => {
  const initialData = useStore.getState().jsonData.competencies as PlannedResultsData | undefined;
  // const initialDataLength = initialData ? Object.keys(initialData).length : 0;
  const disciplineName = useStore.getState().jsonData.disciplins_name as string;

  const { updateJsonData } = useStore();
  const [data, setData] = useState<PlannedResultsData | undefined>(initialData);
  // const [nextId, setNextId] = useState<number>(initialDataLength)

  const filterData = (parsedData: ParsedPlannedResults) => {
    const filteredDataMap: PlannedResultsData = {};
    let competence = "";
    let indicator = "";

    parsedData &&
      Object.values(parsedData).forEach((row) => {
        const dataLength = Object.keys(filteredDataMap).length;

        if (row.competence) {
          competence = `${row.competence}. ${row.results}`;
          indicator = "";
        } else if (row.indicator) {
          indicator = `${row.indicator}. ${row.results}`;
        } else if (row.results === disciplineName) {
          const hasSameEntry = Object.values(filteredDataMap).some(
            (existingRow) => existingRow.competence === competence && existingRow.indicator === indicator
          );

          const competenceValue = hasSameEntry ? "" : competence;

          filteredDataMap[dataLength] = {
            competence: competenceValue,
            indicator,
            results: {
              know: "",
              beAble: "",
              own: "",
            },
          };
        }
      });
    return filteredDataMap;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedData = (await parseCsvToJson(file)) as ParsedPlannedResults;
      const filteredData = filterData(parsedData);
      setData(filteredData);
      showSuccessMessage("Данные успешные загружены");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      showErrorMessage(errorMessage);
    } finally {
      // Allow selecting the same file again (otherwise onChange may not fire)
      event.target.value = "";
    }
  };

  // const handleAddRow = () => {
  //     setNextId(nextId + 1)
  //     const newData = {...data, [nextId]: {competence: '', indicator: '', results: ''}}
  //     setData(newData)
  // }
  //

  const saveData = async () => {
    if (!data) return;
    const id = useStore.getState().jsonData.id;

    try {
      await axiosBase.put(`update-json-value/${id}`, {
        fieldToUpdate: "competencies",
        value: data,
      });

      updateJsonData("competencies", data);
      showSuccessMessage("Данные успешно сохранены");
    } catch (error) {
      showErrorMessage("Ошибка сохранения данных");
      if (isAxiosError(error)) {
        console.error("Ошибка Axios:", error.response?.data);
        console.error("Статус ошибки:", error.response?.status);
        console.error("Заголовки ошибки:", error.response?.headers);
      } else {
        console.error("Неизвестная ошибка:", error);
      }
    }
  };

  const handleValueChange = (id: number, value: string, key: string) => {
    if (!data) return;

    const newData = {
      ...data,
      [id]: {
        ...data[id],
        results: {
          ...data[id].results,
          [key]: value,
        },
      },
    };
    setData(newData);
  };

  const complectId = useStore.getState().complectId;

  useEffect(() => {
    if (data && Object.keys(data).length) return;
    if (!complectId) return;

    (async () => {
      try {
        const response = await axiosBase.get("get-results-data", { params: { complectId } });
        type Row = { competence: string; indicator: string; disciplines: string[] };
        const rows = response.data as Row[];
        const filtered = rows.filter((r) => r.disciplines.includes(disciplineName));

        const mapped: PlannedResultsData = {};
        let idx = 0;
        let lastCompetence = "";
        filtered.forEach((r) => {
          const competenceToSet = r.competence === lastCompetence ? "" : r.competence;
          lastCompetence = r.competence;
          mapped[idx++] = {
            competence: competenceToSet,
            indicator: r.indicator,
            results: { know: "", beAble: "", own: "" },
          };
        });

        setData(mapped);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [data, complectId, disciplineName]);

  if (!data) return <Loader />;

  return (
    <Box>
      <PageTitle title="Планируемые результаты обучения по дисциплине (модулю)" />
      <Box pt={2} display={"flex"} justifyContent="flex-end" gap={1}>
        <Tooltip title="Загрузить файл компетенций (.csv, .xlsx)" arrow>
          <Box component="label" htmlFor="csv-upload">
            <Button variant="outlined" component="span">
              Загрузить файл
            </Button>
            <input
              id="csv-upload"
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </Box>
        </Tooltip>
        <Button variant="contained" onClick={saveData}>
          Сохранить
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ my: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table" size="small" className="table">
          <TableHead>
            <TableRow>
              <TableCell align="center" rowSpan={2}>
                Формируемые компетенции (код и наименование)
              </TableCell>
              <TableCell align="center" rowSpan={2}>
                Индикаторы достижения компетенций (код и формулировка)
              </TableCell>
              <TableCell
                colSpan={3}
                align="center"
                sx={{
                  textAlign: "center",
                }}
              >
                Планируемые результаты обучения по дисциплине (модулю)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell align="center">Владеть</TableCell>
              <TableCell align="center">Знать</TableCell>
              <TableCell align="center">Уметь</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(data).map((key) => {
              return (
                <TableRow key={key}>
                  <TableCell>{data[key].competence}</TableCell>
                  <TableCell>{data[key].indicator}</TableCell>
                  {Object.keys(data[key].results).map((resultKey) => (
                    <TableCell>
                      <TextField
                        fullWidth
                        sx={{ fontSize: "14px !important", "& .MuiInputBase-input": { fontSize: "14px !important" } }}
                        multiline
                        value={data[key].results[resultKey]}
                        onChange={(e) => handleValueChange(Number(key), e.target.value, resultKey)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <ButtonGroup variant="outlined" aria-label="Basic button group">
        {/* <Button onClick={handleAddRow}>Добавить строку</Button> */}
      </ButtonGroup>
    </Box>
  );
};

export default PlannedResultsPage;
