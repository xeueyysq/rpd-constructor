import { FC, useState } from "react";
import { parseCsvToJson } from "@shared/ability/lib/parseCsvToJson";
import { PlannedResultsData } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { showSuccessMessage, showErrorMessage } from "@shared/lib";
import { Box } from "@mui/system";
import {
  Paper,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Table,
  TableBody,
  Container,
} from "@mui/material";

interface Competence {
  id: number;
  name: string;
}

interface Indicator {
  id: number;
  name: string;
  competenceId: number;
}

interface Discipline {
  id: number;
  name: string;
}

interface IndicatorDiscipline {
  indicatorId: number;
  disciplineId: number;
}

interface ResultsData {
  competencies: Competence[];
  indicators: Indicator[];
  disciplines: Discipline[];
  indicatorDisciplines?: IndicatorDiscipline[];
}

export const PlannedResultsList: FC = () => {
  const [data, setData] = useState<ResultsData | undefined>();

  const groupData = (parsedData: PlannedResultsData) => {
    const resultsData: ResultsData = {
      competencies: [],
      indicators: [],
      disciplines: [],
      indicatorDisciplines: [],
    };

    let currentCompetenceId = 1;
    let currentIndicatorId = 1;
    let currentDisciplineId = 1;

    const disciplineNameMap = new Map<string, number>();

    for (const index in parsedData) {
      const item = parsedData[index];

      if (item.competence) {
        resultsData.competencies.push({
          id: currentCompetenceId,
          name: `${item.competence}. ${item.results}`,
        });
        currentCompetenceId++;
      } else if (item.indicator) {
        resultsData.indicators.push({
          id: currentIndicatorId,
          name: `${item.indicator}. ${item.results}`,
          competenceId: currentCompetenceId - 1,
        });
        currentIndicatorId++;
      } else if (item.results) {
        let disciplineId: number;

        if (disciplineNameMap.has(item.results)) {
          disciplineId = disciplineNameMap.get(item.results)!;
        } else {
          disciplineId = currentDisciplineId;
          disciplineNameMap.set(item.results, currentDisciplineId);

          resultsData.disciplines.push({
            id: currentDisciplineId,
            name: item.results,
          });

          currentDisciplineId++;
        }

        resultsData.indicatorDisciplines?.push({
          indicatorId: currentIndicatorId - 1,
          disciplineId: disciplineId,
        });
      }
    }

    setData(resultsData);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsedData = await parseCsvToJson(file);
      groupData(parsedData as PlannedResultsData);
      console.log(data);
      showSuccessMessage("Данные успешно загружены");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      showErrorMessage(errorMessage);
      console.error(error);
    }
  };
  const headers = [
    "Формируемые компетенции (код и наименование)",
    "Индикаторы достижения компетенций (код и формулировка)",
    "Дисциплины",
  ];
  return (
    <Container>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {headers.map((header) => (
                <TableCell key={header}>{header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data &&
              data.competencies.map((competence: Competence) => {
                const relatedIndicators = data.indicators.filter(
                  (i) => i.competenceId === competence.id
                );

                return relatedIndicators.map(
                  (indicator: Indicator, indicatorIndex: number) => {
                    const disciplineIds =
                      data.indicatorDisciplines
                        ?.filter((id) => id.indicatorId === indicator.id)
                        .map((id) => id.disciplineId) || [];

                    const relatedDisciplines = data.disciplines.filter((d) =>
                      disciplineIds.includes(d.id)
                    );

                    return (
                      <TableRow key={`${competence.id}-${indicator.id}`}>
                        <TableCell>
                          {indicatorIndex === 0 ? competence.name : ""}
                        </TableCell>
                        <TableCell>{indicator.name}</TableCell>
                        <TableCell>
                          {relatedDisciplines
                            .map((d) => d.name)
                            .sort()
                            .join(", ")}
                        </TableCell>
                      </TableRow>
                    );
                  }
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};
