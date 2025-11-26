import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { Box } from "@mui/system";
import { parseCsvToJson, ParsedPlannedResults } from "@shared/ability/lib/parseCsvToJson";
import { axiosBase } from "@shared/api";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { ComplectData } from "@shared/types";
import { PageTitle } from "@shared/ui";
import { FC, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { isAxiosError } from "axios";

interface ResultsRow {
  competence: string;
  indicator: string;
  disciplines: string[];
}

interface ResultsData {
  [id: number]: ResultsRow;
}

type FilterState = {
  profile: string;
  formEducation: string;
  year: number | null;
};

export const PlannedResultsList: FC = () => {
  const [data, setData] = useState<ResultsData | undefined>();
  const location = useLocation();

  const filtersState = location.state as FilterState;

  const [complects, setComplects] = useState<ComplectData[]>([]);
  const [filters, setFilters] = useState<FilterState>(filtersState || { profile: "", formEducation: "", year: null });
  const [selectedComplectId, setSelectedComplectId] = useState<number>();

  const options = useMemo(() => {
    const profiles = Array.from(new Set(complects.map((i) => i.profile)));
    const forms = Array.from(new Set(complects.map((i) => i.formEducation)));
    const years = Array.from(new Set(complects.map((i) => i.year))).sort((a, b) => Number(b) - Number(a));
    return { profiles, forms, years };
  }, [complects]);

  const filtersComplete = Boolean(filters.profile && filters.formEducation && filters.year);

  useEffect(() => {
    const fetchComplectsForOptions = async () => {
      try {
        const response = await axiosBase.get("get-rpd-complects");
        const list = response.data as ComplectData[];
        setComplects(list);
      } catch (error) {
        console.error(error);
      }
    };
    fetchComplectsForOptions();
  }, []);

  useEffect(() => {
    if (!filtersComplete) return;
    const complect = complects.find((c) => {
      const matchesProfile = c.profile === filters.profile;
      const matchesForm = c.formEducation === filters.formEducation;
      const matchesYear = Number(c.year) === filters.year;
      return matchesProfile && matchesForm && matchesYear;
    });
    if (!complect) {
      setData(undefined);
      setSelectedComplectId(undefined);
      return;
    }
    setSelectedComplectId(complect.id);
    (async () => {
      try {
        const response = await axiosBase.get("get-results-data", { params: { complectId: complect.id } });
        const rows = response.data as ResultsRow[];
        const mapped: ResultsData = {};
        rows.forEach((row, idx) => (mapped[idx] = row));
        setData(mapped);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [filtersComplete, filters, complects]);

  const groupData = (parsedData: ParsedPlannedResults) => {
    const resultsData: ResultsData = {};
    let currentId = 0;
    let currentCompetence = "";
    let currentRowIdForCompetence: number | null = null;

    for (const index in parsedData) {
      const item = parsedData[index];

      if (item.competence) {
        currentCompetence = `${item.competence}. ${item.results}`;
        currentRowIdForCompetence = null;
      } else if (item.indicator) {
        resultsData[currentId] = {
          competence: currentCompetence,
          indicator: `${item.indicator}. ${item.results}`,
          disciplines: [],
        };
        currentRowIdForCompetence = currentId;
        currentId++;
      } else if (item.results) {
        if (currentRowIdForCompetence === null) {
          resultsData[currentId] = {
            competence: currentCompetence,
            indicator: "",
            disciplines: [],
          };
          currentRowIdForCompetence = currentId;
          currentId++;
        }
        resultsData[currentRowIdForCompetence].disciplines.push(item.results);
      }
    }
    return resultsData;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsedData = await parseCsvToJson(file);
      const resultsData = groupData(parsedData as ParsedPlannedResults);
      setData(resultsData);
      showSuccessMessage("Данные успешно загружены");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Не удалось загрузить файл компетенций";
      showErrorMessage(errorMessage);
      console.error(error);
    }
  };

  const saveData = async () => {
    if (!selectedComplectId) return;
    try {
      const payload = Array.isArray(data) ? data : Object.values(data ?? {});
      await axiosBase.post("set-results-data", {
        data: payload,
        complectId: selectedComplectId,
      });
      showSuccessMessage("Данные успешно загружены");
    } catch (error) {
      const errorMessage = isAxiosError(error) ? error.message : "Неизвестная ошибка";
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
    <Box>
      <PageTitle title={"Загрузка компетенций для всех дисциплин"} />
      <Box pt={2} display={"flex"} justifyContent={"space-between"}>
        <Box display={"flex"} gap={2} alignItems={"center"} py={3} flexWrap={"wrap"}>
          <FormControl sx={{ minWidth: 260 }}>
            <InputLabel
              size="small"
              sx={{
                top: "50%",
                transform: "translate(14px, -50%)",
                "&.MuiInputLabel-shrink": {
                  top: 0,
                  transform: "translate(14px, -9px) scale(0.75)",
                },
              }}
              id="profile-label"
            >
              Профиль
            </InputLabel>
            <Select
              labelId="profile-label"
              label="Профиль"
              sx={{ "& .MuiSelect-select": { py: 0.5 } }}
              value={filters.profile}
              onChange={(e) => setFilters((prev) => ({ ...prev, profile: e.target.value }))}
            >
              {options.profiles.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel
              id="form-label"
              size="small"
              sx={{
                top: "50%",
                transform: "translate(14px, -50%)",
                "&.MuiInputLabel-shrink": {
                  top: 0,
                  transform: "translate(14px, -9px) scale(0.75)",
                },
              }}
            >
              Форма обучения
            </InputLabel>
            <Select
              labelId="form-label"
              label="Форма обучения"
              value={filters.formEducation}
              sx={{ "& .MuiSelect-select": { py: 0.5 } }}
              onChange={(e) => setFilters((prev) => ({ ...prev, formEducation: e.target.value }))}
            >
              {options.forms.map((f) => (
                <MenuItem key={f} value={f}>
                  {f}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel
              size="small"
              sx={{
                top: "50%",
                transform: "translate(14px, -50%)",
                "&.MuiInputLabel-shrink": {
                  top: 0,
                  transform: "translate(14px, -9px) scale(0.75)",
                },
              }}
              id="year-label"
            >
              Год набора
            </InputLabel>
            <Select
              sx={{ "& .MuiSelect-select": { py: 0.5 } }}
              labelId="year-label"
              label="Год набора"
              value={filters.year ?? ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, year: Number(e.target.value) }))}
            >
              {options.years.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box display={"flex"} justifyContent={"space-between"} alignItems={"center"} py={1} gap={1}>
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
          <Button onClick={() => saveData()} variant="contained">
            Сохранить
          </Button>
        </Box>
      </Box>
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
            {filtersComplete && data ? (
              Object.entries(data).map(([key, row]) => (
                <TableRow key={key}>
                  <TableCell>
                    {Number(key) === 0 || row.competence !== data[Number(key) - 1].competence ? row.competence : ""}
                  </TableCell>
                  <TableCell>{row.indicator}</TableCell>
                  <TableCell>{row.disciplines.join(", ")}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={headers.length} align="center">
                  <Typography color="textDisabled">Компетенции пока не были загружены</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
