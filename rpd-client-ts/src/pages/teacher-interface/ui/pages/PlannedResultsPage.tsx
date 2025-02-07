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
import { PlannedResultsData } from "../../model/DisciplineContentPageTypes.ts";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { axiosBase } from "@shared/api";
import Papa from "papaparse";
import { Can } from "@shared/ability";

const PlannedResultsPage: FC = () => {
  const initialData = useStore.getState().jsonData.competencies as
    | PlannedResultsData
    | undefined;
  // const initialDataLength = initialData ? Object.keys(initialData).length : 0;
  const disciplineName = useStore.getState().jsonData.disciplins_name as string;

  const { updateJsonData } = useStore();
  const [data, setData] = useState<PlannedResultsData | undefined>(initialData);
  // const [nextId, setNextId] = useState<number>(initialDataLength)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("Начало обработки файла");
    console.log("Искомая дисциплина:", disciplineName);

    Papa.parse(file, {
      complete: (results) => {
        const rows = results.data as string[][];
        let currentCompetence = "";
        let currentCompetenceContent = "";
        const competenciesMap = new Map<
          string,
          {
            competence: string;
            indicators: { code: string; content: string }[];
          }
        >();
        const disciplineRows = new Set<number>();

        // Сначала найдем все строки с нашей дисциплиной
        for (let i = 1; i < rows.length; i++) {
          const [, , disc, content] = rows[i];
          if (disc && content.trim() === disciplineName.trim()) {
            disciplineRows.add(i);
            console.log("Найдена дисциплина в строке:", i);
          }
        }

        if (disciplineRows.size === 0) {
          showErrorMessage("Дисциплина не найдена в файле");
          return;
        }

        // Теперь обработаем компетенции для найденных строк
        disciplineRows.forEach((rowIndex) => {
          // Идем назад от строки с дисциплиной, пока не найдем компетенцию
          for (let i = rowIndex; i >= 0; i--) {
            const [comp, , , content] = rows[i];
            if (comp) {
              currentCompetence = comp;
              currentCompetenceContent = content;
              if (!competenciesMap.has(currentCompetence)) {
                competenciesMap.set(currentCompetence, {
                  competence: `${currentCompetence} ${currentCompetenceContent}`,
                  indicators: [],
                });
              }
              break;
            }
          }

          // Теперь собираем индикаторы для найденной компетенции
          for (let i = rowIndex - 1; i >= 0; i--) {
            const [comp, ind, , content] = rows[i];
            // Если встретили новую компетенцию, прекращаем поиск индикаторов
            if (comp) break;
            // Если нашли индикатор
            if (ind && currentCompetence) {
              const competenceData = competenciesMap.get(currentCompetence);
              if (
                competenceData &&
                !competenceData.indicators.some(
                  (indicator) => indicator.code === ind
                )
              ) {
                competenceData.indicators.push({
                  code: ind,
                  content: content,
                });
              }
            }
          }
        });

        console.log("\nРезультаты обработки:");
        console.log(
          "Найденные компетенции:",
          Array.from(competenciesMap.keys())
        );

        // Преобразуем данные в формат PlannedResultsData
        const formattedData: PlannedResultsData = {};
        let index = 0;

        competenciesMap.forEach((value) => {
          // Добавляем первую строку с компетенцией и первым индикатором
          if (value.indicators.length > 0) {
            formattedData[index] = {
              competence: value.competence,
              indicator: `${value.indicators[0].code} ${value.indicators[0].content}`,
              results: "",
            };
            index++;

            // Добавляем остальные индикаторы с пустой компетенцией
            for (let i = 1; i < value.indicators.length; i++) {
              formattedData[index] = {
                competence: "",
                indicator: `${value.indicators[i].code} ${value.indicators[i].content}`,
                results: "",
              };
              index++;
            }
          }
        });

        if (Object.keys(formattedData).length === 0) {
          showErrorMessage("Не найдено компетенций для данной дисциплины");
          return;
        }

        console.log(
          "Количество обработанных строк:",
          Object.keys(formattedData).length
        );

        setData(formattedData);
        // setNextId(Object.keys(formattedData).length)
        showSuccessMessage("Данные успешно загружены");
      },
      encoding: "cp1251",
      delimiter: ";",
      error: (error) => {
        showErrorMessage("Ошибка при чтении файла");
        console.error("Ошибка парсинга:", error);
      },
    });
  };

  // const handleAddRow = () => {
  //     setNextId(nextId + 1)
  //     const newData = {...data, [nextId]: {competence: '', indicator: '', results: ''}}
  //     setData(newData)
  // }

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
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <TableContainer component={Paper} sx={{ my: 2 }}>
        <Table
          sx={{ minWidth: 650 }}
          aria-label="simple table"
          size="small"
          className="table"
        >
          <TableHead>
            <TableRow>
              <TableCell align="center">
                Формируемые компетенции(код и наименование)
              </TableCell>
              <TableCell align="center">
                Индикаторы достижения компетенций (код и формулировка)
              </TableCell>
              <TableCell align="center">
                Планируемые результаты обучения по дисциплине (модулю)
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(data).map((key) => (
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
                    <EditableCell
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
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <ButtonGroup
        variant="outlined"
        aria-label="Basic button group"
        size="small"
      >
        {/* <Button onClick={handleAddRow}>Добавить строку</Button> */}
        <Button variant="contained" onClick={saveData}>
          Сохранить изменения
        </Button>
      </ButtonGroup>
    </Box>
  );
};

export default PlannedResultsPage;
