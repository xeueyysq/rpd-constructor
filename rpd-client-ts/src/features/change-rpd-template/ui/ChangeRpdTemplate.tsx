import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { FC, useCallback, useEffect, useState } from "react";
import {
  SelectedTemplateData,
  SelectTeacherParams,
  useStore,
} from "@shared/hooks";
import { TemplateConstructorType, TemplateStatus } from "@entities/template";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { useAuth } from "@entities/auth";
import { axiosBase } from "@shared/api";
import { Loader } from "@shared/ui";
import { TemplateStatusEnum } from "@entities/template";

interface TemplateStatusObject {
  date: string;
  status: string;
  user: string;
}

interface TemplateData {
  id: number;
  disciplins_name: string;
  teacher: string;
  status: TemplateStatusObject;
}

export const ChangeRpdTemplate: FC<TemplateConstructorType> = ({
  setChoise,
}) => {
  const selectedTemplateData = useStore.getState().selectedTemplateData;
  const userName = useAuth.getState().userName;
  const [data, setData] = useState<TemplateData[]>();

  const fetchData = useCallback(async () => {
    const params: SelectedTemplateData = {
      ...selectedTemplateData,
    };

    try {
      const response = await axiosBase.get("find-by-criteria", {
        params,
      });
      setData(response.data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [selectedTemplateData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sendTemplateToTeacher = async (id: number, teacher: string) => {
    const params: SelectTeacherParams = {
      id,
      teacher,
      userName,
    };
    try {
      const response = await axiosBase.post("send-template-to-teacher", {
        params,
      });

      if (response.data === "UserNotFound")
        showErrorMessage("Ошибка. Пользователь не найден");
      if (response.data === "TemplateAlreadyBinned")
        showErrorMessage("Ошибка. Данный шаблон уже отправлен преподавателю");
      if (response.data === "binnedSuccess") {
        showSuccessMessage("Шаблон успешно отправлен преподавателю");
        fetchData();
      }
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  };

  if (!data) return <Loader />;

  return (
    <>
      <Box>Шаг 3. Выбор РПД для редактирования</Box>
      <Box sx={{ py: 2, fontSize: "18px", fontWeight: "600" }}>Шаблоны:</Box>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "600" }}>
                Название дисциплины
              </TableCell>
              <TableCell sx={{ fontWeight: "600" }}>
                Преподаватель, ответственный за РПД
              </TableCell>
              <TableCell sx={{ fontWeight: "600" }}>Статус</TableCell>
              <TableCell sx={{ fontWeight: "600" }}>Выбрать</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.id}
                sx={{
                  "&:last-child td, &:last-child th": {
                    border: 0,
                  },
                }}
              >
                <TableCell>{row.disciplins_name}</TableCell>
                <TableCell>{row.teacher}</TableCell>
                <TableCell>
                  <TemplateStatus status={row.status} />
                </TableCell>
                <TableCell>
                  {row.status.status !== TemplateStatusEnum.ON_TEACHER && (
                    <Button
                      variant="outlined"
                      onClick={() => sendTemplateToTeacher(row.id, row.teacher)}
                    >
                      Отправить преподавателю
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        variant="outlined"
        sx={{ mt: 2 }}
        onClick={() => setChoise("workingType")}
      >
        Назад
      </Button>
    </>
  );
};
