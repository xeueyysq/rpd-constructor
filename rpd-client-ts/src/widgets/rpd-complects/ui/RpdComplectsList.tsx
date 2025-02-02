import { FC, useEffect, useState } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from "@mui/material";
import { axiosBase } from "@shared/api";
import { Loader } from "@shared/ui";
import { useStore } from "@shared/hooks";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { showErrorMessage } from "@shared/lib";
import type { RpdComplect } from "../model";

interface RpdComplectsListType {
  setChoise: (value: string) => void;
}

export const RpdComplectsList: FC<RpdComplectsListType> = ({ setChoise }) => {
  const [complects, setComplects] = useState<RpdComplect[]>([]);
  const [loading, setLoading] = useState(true);
  const { setComplectId, setSelectedTemplateData } = useStore();

  useEffect(() => {
    fetchComplects();
  }, []);

  const fetchComplects = async () => {
    try {
      const response = await axiosBase.get("get-rpd-complects");
      setComplects(response.data);
      setLoading(false);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
      setLoading(false);
    }
  };

  const handleViewComplect = (complect: RpdComplect) => {
    setSelectedTemplateData(
      complect.faculty,
      complect.levelEducation,
      complect.directionOfStudy,
      complect.profile,
      complect.formEducation,
      complect.year
    );
    setComplectId(complect.id);
    setChoise("createTemplateFromExchange");
  };

  if (loading) return <Loader />;

  return (
    <Box sx={{ my: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Box sx={{ m: 0 }}>Список всех комплектов РПД</Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Институт</TableCell>
              <TableCell>Уровень образования</TableCell>
              <TableCell>Направление</TableCell>
              <TableCell>Профиль</TableCell>
              <TableCell>Форма обучения</TableCell>
              <TableCell>Год набора</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {complects.map((complect) => (
              <TableRow key={complect.id}>
                <TableCell>{complect.faculty}</TableCell>
                <TableCell>{complect.levelEducation}</TableCell>
                <TableCell>{complect.directionOfStudy}</TableCell>
                <TableCell>{complect.profile}</TableCell>
                <TableCell>{complect.formEducation}</TableCell>
                <TableCell>{complect.year}</TableCell>
                <TableCell align="center">
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleViewComplect(complect)}
                  >
                    Просмотр
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button
        variant="outlined"
        onClick={() => setChoise("selectData")}
        sx={{ mt: 2 }}
      >
        Назад
      </Button>
    </Box>
  );
};
