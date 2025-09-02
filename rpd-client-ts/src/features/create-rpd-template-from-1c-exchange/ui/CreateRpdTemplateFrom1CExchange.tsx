import { FC, useCallback, useEffect, useState } from "react";
import { TemplateConstructorType, TemplateStatus } from "@entities/template";
import { useStore } from "@shared/hooks";
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
} from "@mui/material";
import { useAuth } from "@entities/auth";
import TemplateMenu from "./TemplateMenu.tsx";
import { axiosBase } from "@shared/api";
import {
  showErrorMessage,
  showSuccessMessage,
  showWarningMessage,
} from "@shared/lib";
import { Loader } from "@shared/ui";
import { StatusCell } from "@pages/teacher-interface-templates/ui/StatusCell.tsx";
import { TemplateStatusEnum } from "@entities/template";

interface TemplateStatusObject {
  date: string;
  status: string;
  user: string;
}

interface TemplateData {
  id: number;
  id_profile_template: number;
  discipline: string;
  teachers: string[];
  teacher: string;
  semester: number;
  status: TemplateStatusObject;
}

export interface CreateTemplateDataParams {
  id_1c: number;
  complectId: number | undefined;
  teacher: string;
  year: string | undefined;
  discipline: string;
  userName: string | undefined;
}

export const CreateRpdTemplateFrom1CExchange: FC<TemplateConstructorType> = ({
  setChoise,
}) => {
  const selectedTemplateData = useStore.getState().selectedTemplateData;
  const complectId = useStore.getState().complectId;
  const [data, setData] = useState<TemplateData[]>();
  const [selectedTeachers, setSelectedTeachers] = useState<{
    [key: number]: string;
  }>({});
  const userName = useAuth.getState().userName;
  const [searchValue, setSearchValue] = useState("");

  const handleFilteredData = () => {
    if (data) {
      return data
        .filter((row) =>
          row.discipline.toLowerCase().includes(searchValue.toLowerCase())
        )
        .sort((a, b) => {
          const priority: Record<string, number> = {
            [TemplateStatusEnum.UNLOADED]: 1,
          };
          return (
            (priority[a.status.status] || 0) - (priority[b.status.status] || 0)
          );
        });
    }
  };

  const handleChange = (templateId: number) => (event: SelectChangeEvent) => {
    setSelectedTeachers((prevSelectedTeachers) => ({
      ...prevSelectedTeachers,
      [templateId]: event.target.value,
    }));
  };

  const fetchData = useCallback(async () => {
    try {
      const response = await axiosBase.post("find-rpd", { complectId });
      setData(response.data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [complectId]);

  const createTemplateData = async (id: number, discipline: string) => {
    const teacher = selectedTeachers[id];
    if (!teacher) {
      showWarningMessage("Необходимо выбрать преподавателя");
      return;
    }

    try {
      const params: CreateTemplateDataParams = {
        id_1c: id,
        complectId,
        teacher,
        year: selectedTemplateData.year,
        discipline,
        userName,
      };

      const response = await axiosBase.post(
        "create-profile-template-from-1c",
        params
      );

      if (response.data === "record exists")
        showErrorMessage("Ошибка. Шаблон с текущими данными уже существует");
      if (response.data === "template created") {
        showSuccessMessage("Шаблон успешно создан");
        fetchData();
      }
    } catch (error) {
      showErrorMessage("Ошибка. Не удалось создать шаблон");
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!data) return <Loader />;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography component="span" variant="h6">
          {selectedTemplateData.profile} ({selectedTemplateData.year})
        </Typography>
      </Box>

      <Box sx={{ py: 2 }}>
        <TextField
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Поиск дисциплины"
          variant="standard"
        />
      </Box>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table" size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "600" }}></TableCell>
              <TableCell
                sx={{
                  fontWeight: "600",
                  fontSize: "18px",
                  py: 2,
                }}
              >
                Дисциплина
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "600",
                  fontSize: "18px",
                  py: 2,
                }}
              >
                Семестр
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "600",
                  fontSize: "18px",
                  py: 2,
                }}
              >
                Преподаватель
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "600",
                  fontSize: "18px",
                  py: 2,
                }}
              >
                Статус
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "600",
                  fontSize: "18px",
                  py: 2,
                }}
              >
                Выбрать
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {handleFilteredData()?.map((row) => (
              <TableRow key={row.id}>
                <StatusCell status={row.status.status} />
                <TableCell sx={{ maxWidth: "400px" }}>
                  {row.discipline}
                </TableCell>
                <TableCell>{row.semester}</TableCell>
                <TableCell>
                  <FormControl fullWidth variant="standard" size="small">
                    {row.teacher ? (
                      <Select
                        sx={{ maxWidth: 160 }}
                        labelId={`select-label-${row.id}`}
                        id={`select-${row.id}`}
                        value={row.teacher}
                        label="Преподаватель"
                        disabled
                        autoWidth
                      >
                        <MenuItem key={row.teacher} value={row.teacher}>
                          {row.teacher}
                        </MenuItem>
                      </Select>
                    ) : (
                      <Select
                        sx={{ maxWidth: 160 }}
                        labelId={`select-label-${row.id}`}
                        id={`select-${row.id}`}
                        value={selectedTeachers[row.id] || ""}
                        label="Преподаватель"
                        onChange={handleChange(row.id)}
                        autoWidth
                      >
                        {row.teachers.map((name) => (
                          <MenuItem key={name} value={name}>
                            {name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  </FormControl>
                </TableCell>
                <TableCell width={"17%"}>
                  <TemplateStatus status={row.status} />
                </TableCell>
                <TableCell>
                  {row.status.status === TemplateStatusEnum.UNLOADED ? (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => createTemplateData(row.id, row.discipline)}
                    >
                      Создать
                    </Button>
                  ) : (
                    <TemplateMenu
                      id={row.id_profile_template}
                      teacher={row.teacher}
                      status={row.status.status}
                      fetchData={fetchData}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
};
