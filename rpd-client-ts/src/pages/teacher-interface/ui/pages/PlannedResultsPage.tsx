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
import { PlannedResultsData, Results } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { Can } from "@shared/ability";
import { parseCsvToJson, ParsedPlannedResults } from "@shared/ability/lib/parseCsvToJson.ts";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Loader } from "@shared/ui";
import axios from "axios";
import { FC, useState } from "react";
import EditableCell from "../changeable-elements/EditableCell.tsx";
import PlannedResultsCell from "../changeable-elements/PlannedResultsCell.tsx";

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
      Object.entries(parsedData).forEach(([key, row]) => {
        const dataLenght = Object.keys(filteredDataMap).length;
        if (row.competence) {
          competence = `${row.competence}. ${row.results}`;
        } else if (row.indicator) {
          indicator = `${row.indicator}. ${row.results}`;
        } else if (row.results === disciplineName) {
          if (Object.values(filteredDataMap).find((row) => row.competence === competence)) competence = "";
          filteredDataMap[dataLenght] = {
            competence,
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
      if (axios.isAxiosError(error)) {
        console.error("Ошибка Axios:", error.response?.data);
        console.error("Статус ошибки:", error.response?.status);
        console.error("Заголовки ошибки:", error.response?.headers);
      } else {
        console.error("Неизвестная ошибка:", error);
      }
    }
  };

  const handleValueChange = (id: number, value: Results) => {
    if (!data) return;

    const newData = {
      ...data,
      [id]: {
        ...data[id],
        results: value,
      },
    };
    setData(newData);
  };

  if (!data) return <Loader />;

  return (
    <Box>
      <Box fontSize={"1.5rem"}>Планируемые результаты обучения по дисциплине (модулю)</Box>
      <Box pt={3} display={"flex"} justifyContent={"space-between"} alignItems={"center"}>
        <input type="file" accept=".csv" onChange={handleFileUpload} />
        <Button variant="contained" onClick={saveData}>
          Сохранить
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ my: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table" size="small" className="table">
          <TableHead>
            <TableRow>
              <TableCell
                align="center"
                sx={{
                  fontFamily: "Times New Roman",
                  fontSize: 16,
                }}
              >
                Формируемые компетенции (код и наименование)
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  fontFamily: "Times New Roman",
                  fontSize: 16,
                }}
              >
                Индикаторы достижения компетенций (код и формулировка)
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  fontFamily: "Times New Roman",
                  fontSize: 16,
                }}
              >
                Планируемые результаты обучения по дисциплине (модулю)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(data).map((key) => {
              return (
                <TableRow key={key}>
                  <TableCell>
                    <EditableCell value={data[key].competence} onValueChange={() => {}} readOnly />
                  </TableCell>
                  <TableCell>
                    <EditableCell value={data[key].indicator} onValueChange={() => {}} readOnly />
                  </TableCell>
                  <TableCell>
                    <Can I="edit" a="competencies">
                      <PlannedResultsCell
                        value={data[key].results}
                        onValueChange={(value: Results) => handleValueChange(Number(key), value)}
                      />
                    </Can>
                    <Can not I="edit" a="competencies">
                      <PlannedResultsCell
                        value={data[key].results}
                        onValueChange={(value: Results) => handleValueChange(Number(key), value)}
                      />
                    </Can>
                  </TableCell>
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
