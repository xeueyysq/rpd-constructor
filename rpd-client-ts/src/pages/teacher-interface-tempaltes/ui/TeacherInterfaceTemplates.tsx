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
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
} from "@mui/material";
import { FC, useCallback, useEffect, useState } from "react";
import { useAuth } from "@entities/auth";
import { TemplateConstructorType, TemplateStatus } from "@entities/template";
import { useStore } from "@shared/hooks";
import { axiosBase } from "@shared/api";
import { Loader } from "@shared/ui";
import { showErrorMessage, showSuccessMessage } from "@shared/lib";
import { Header } from "@widgets/header";
import { useNavigate } from "react-router-dom";
import CheckCircle from "@mui/icons-material/CheckCircle";
import FolderOpen from "@mui/icons-material/FolderOpen";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

interface TemplateStatusObject {
  date: string;
  status: string;
  user: string;
}

interface TemplateData {
  id: number;
  disciplins_name: string;
  faculty: string;
  direction: string;
  profile: string;
  education_level: string;
  education_form: string;
  year: number;
  status: TemplateStatusObject;
}

export interface employedTemplateParams {
  id: number;
  userName: string | undefined;
}

export const TeacherInterfaceTemplates: FC = () => {
  const userName = useAuth.getState().userName;
  const { setJsonData } = useStore();
  const [data, setData] = useState<TemplateData[]>();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null
  );

  const fetchData = useCallback(async () => {
    try {
      const response = await axiosBase.post("find-teacher-templates", {
        userName,
      });
      setData(response.data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [userName]);

  const employedTemplate = async (id: number) => {
    try {
      const params: employedTemplateParams = {
        id,
        userName,
      };
      const responce = await axiosBase.post(
        "employed-teacher-template",
        params
      );
      if (responce.data === "success") {
        showSuccessMessage("Статус шаблона успешно изменен");
        fetchData();
      }
    } catch (error) {
      showErrorMessage("Ошибка при изменении статуса шаблона");
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const uploadTemplateData = async (id: number) => {
    try {
      const response = await axiosBase.post("rpd-profile-templates", { id });
      setJsonData(response.data);
      navigate("/teacher-interface");
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: number) => {
    setAnchorEl(event.currentTarget);
    setSelectedTemplateId(id);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTemplateId(null);
  };

  const markAsReady = async () => {
    if (!selectedTemplateId) return;
    try {
      const response = await axiosBase.post("mark-template-as-ready", {
        id: selectedTemplateId,
        userName,
      });
      if (response.data === "success") {
        showSuccessMessage("Статус шаблона изменен на 'Готов'");
        fetchData();
      }
    } catch (error) {
      showErrorMessage("Ошибка при изменении статуса шаблона");
      console.error(error);
    } finally {
      handleMenuClose();
    }
  };

  if (!data) return <Loader />;

  return (
    <>
      <Header />
      <Box
        sx={{
          p: 2,
          ml: 2,
          backgroundColor: "#fefefe",
          width: "100%",
        }}
      >
        <Box component="h2" sx={{ py: 1 }}>
          Выбор шаблона для редактирования
        </Box>
        <Box sx={{ py: 2, fontSize: "18px", fontWeight: "600" }}>Шаблоны:</Box>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "600" }}>
                  Название дисциплины
                </TableCell>
                <TableCell sx={{ fontWeight: "600" }}>Институт</TableCell>
                <TableCell sx={{ fontWeight: "600" }}>
                  Уровень образования
                </TableCell>
                <TableCell sx={{ fontWeight: "600" }}>
                  Направление обучения
                </TableCell>
                <TableCell sx={{ fontWeight: "600" }}>Профиль</TableCell>
                <TableCell sx={{ fontWeight: "600" }}>Форма обучения</TableCell>
                <TableCell sx={{ fontWeight: "600" }}>Год набора</TableCell>
                <TableCell sx={{ fontWeight: "600" }}>Статус</TableCell>
                <TableCell sx={{ fontWeight: "600" }}>Выбрать</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.id}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell>{row.disciplins_name}</TableCell>
                  <TableCell>{row.faculty}</TableCell>
                  <TableCell>{row.education_level}</TableCell>
                  <TableCell>{row.direction}</TableCell>
                  <TableCell>{row.profile}</TableCell>
                  <TableCell>{row.education_form}</TableCell>
                  <TableCell>{row.year}</TableCell>
                  <TableCell>
                    <TemplateStatus status={row.status} />
                  </TableCell>
                  <TableCell sx={{ minWidth: "140px" }}>
                    {row.status.status === "Взят в работу" ? (
                      <>
                        <IconButton onClick={(e) => handleMenuOpen(e, row.id)}>
                          <MoreHorizIcon />
                        </IconButton>
                        <Menu
                          anchorEl={anchorEl}
                          open={
                            Boolean(anchorEl) && selectedTemplateId === row.id
                          }
                          onClose={handleMenuClose}
                        >
                          <MenuItem
                            onClick={() => {
                              uploadTemplateData(row.id);
                              handleMenuClose();
                            }}
                          >
                            <ListItemIcon>
                              <FolderOpen fontSize="small" />
                            </ListItemIcon>
                            Открыть
                          </MenuItem>
                          <MenuItem onClick={markAsReady}>
                            <ListItemIcon>
                              <CheckCircle fontSize="small" />
                            </ListItemIcon>
                            Готов
                          </MenuItem>
                        </Menu>
                      </>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => employedTemplate(row.id)}
                      >
                        Взять в работу
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </>
  );
};
