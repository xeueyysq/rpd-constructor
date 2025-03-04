import { useStore } from "@shared/hooks";
import axios from "axios";
import { FC, useState } from "react";
import EditableCell from "../changeable-elements/EditableCell.tsx";
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
import { Loader } from "@shared/ui";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";
import Papa from "papaparse";
import { Can } from "@shared/ability";
import { KeyOutlined } from "@mui/icons-material";
import PlannedResultsCell from "../changeable-elements/PlannedResultsCell.tsx";
import { PlannedResultsData } from "@pages/teacher-interface/model/DisciplineContentPageTypes.ts";
import { parseCsvToJson } from "@shared/ability/lib/parseCsvToJson.ts";

const PlannedResultsPage: FC = () => {
  const initialData = useStore.getState().jsonData.competencies as
    | PlannedResultsData
    | undefined;
  // const initialDataLength = initialData ? Object.keys(initialData).length : 0;
  const disciplineName = useStore.getState().jsonData.disciplins_name as string;

  const { updateJsonData } = useStore();
  const [data, setData] = useState<PlannedResultsData | undefined>(initialData);
  // const [nextId, setNextId] = useState<number>(initialDataLength)

  const filterData = (parsedData: PlannedResultsData) => {
    const filteredDataMap: PlannedResultsData = {};
    let competence = "";
    let indicator = "";
    const results = JSON.stringify({
      know: "",
      beAble: "",
      own: "",
    });
    parsedData &&
      Object.entries(parsedData).forEach(([key, row]) => {
        const dataLenght = Object.keys(filteredDataMap).length;
        if (row.competence) {
          competence = `${row.competence}. ${row.results}`;
        } else if (row.indicator) {
          indicator = `${row.indicator}. ${row.results}`;
        } else if (row.results === disciplineName) {
          if (
            Object.values(filteredDataMap).find(
              (row) => row.competence === competence
            )
          )
            competence = "";
          filteredDataMap[dataLenght] = {
            competence,
            indicator,
            results,
          };
        }
      });
    console.log("Отфильтрованные данные:", filteredDataMap);
    return filteredDataMap;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedData = await parseCsvToJson(file);
      const filteredData = filterData(parsedData as PlannedResultsData);
      setData(filteredData);
      showSuccessMessage("Данные успешные загружены");
      console.log(data);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      showErrorMessage(errorMessage);
    }
  };

  // const handleAddRow = () => {
  //     setNextId(nextId + 1)
  //     const newData = {...data, [nextId]: {competence: '', indicator: '', results: ''}}
  //     setData(newData)
  // }
  //

  const handleValueChange = (id: number, key: string, value: string) => {
    if (!data) return;

    const newData = {
      ...data,
      [id]: {
        ...data[id],
        [key]: value,
      },
    };
    setData(newData);
  };

  const saveData = async () => {
    if (!data) return;

    const id = useStore.getState().jsonData.id;

    const filteredData = Object.entries(data).reduce(
      (acc: PlannedResultsData, [key, value]) => {
        if (value.competence || value.indicator || value.results) {
          acc[key] = value;
        }
        return acc;
      },
      {}
    );

    try {
      await axiosBase.put(`update-json-value/${id}`, {
        fieldToUpdate: "competencies",
        value: filteredData,
      });

      updateJsonData("competencies", filteredData);
      setData(filteredData);
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

  if (!data) return <Loader />;

  return (
    <Box>
      <Box component="h2">
        Планируемые результаты обучения по дисциплине (модулю)
      </Box>
      <Box
        pt={3}
        display={"flex"}
        justifyContent={"space-between"}
        alignItems={"center"}
      >
        <input type="file" accept=".csv" onChange={handleFileUpload} />
        <Button size="medium" variant="contained" onClick={saveData}>
          Сохранить
        </Button>
      </Box>
      <TableContainer component={Paper} sx={{ my: 2 }}>
        <Table
          sx={{ minWidth: 650 }}
          aria-label="simple table"
          size="small"
          className="table"
        >
          <TableHead>
            <TableRow>
              <TableCell
                align="center"
                sx={{ fontFamily: "Times New Roman", fontSize: 16 }}
              >
                Формируемые компетенции (код и наименование)
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontFamily: "Times New Roman", fontSize: 16 }}
              >
                Индикаторы достижения компетенций (код и формулировка)
              </TableCell>
              <TableCell
                align="center"
                sx={{ fontFamily: "Times New Roman", fontSize: 16 }}
              >
                Планируемые результаты обучения по дисциплине (модулю)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(data).map((key) => {
              console.log("Данные, загружаемые в таблицу", data);
              console.log(data[key].competence);
              return (
                <TableRow key={key}>
                  <TableCell>
                    <EditableCell
                      value={data[key].competence}
                      onValueChange={() => {}}
                      readOnly
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={data[key].indicator}
                      onValueChange={() => {}}
                      readOnly
                    />
                  </TableCell>
                  <TableCell>
                    <Can I="edit" a="competencies">
                      <PlannedResultsCell
                        value={data[key].results}
                        onValueChange={(value: string) =>
                          handleValueChange(Number(key), "results", value)
                        }
                      />
                    </Can>
                    <Can not I="edit" a="competencies">
                      <EditableCell
                        value={data[key].results}
                        onValueChange={() => {}}
                        readOnly
                      />
                    </Can>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <ButtonGroup
        variant="outlined"
        aria-label="Basic button group"
        size="small"
      >
        {/* <Button onClick={handleAddRow}>Добавить строку</Button> */}
      </ButtonGroup>
    </Box>
  );
};

export default PlannedResultsPage;
