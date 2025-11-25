import { useAuth } from "@entities/auth";
import { setTemplateStatus, TemplateStatus, TemplateStatusEnum } from "@entities/template";
import CheckCircle from "@mui/icons-material/CheckCircle";
import FolderOpen from "@mui/icons-material/FolderOpen";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { Box, Button, CssBaseline, IconButton, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { axiosBase } from "@shared/api";
import { RedirectPath } from "@shared/enums";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import { Loader, PageTitle } from "@shared/ui";
import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusCell } from "./StatusCell";

interface TemplateStatusObject {
  date: string;
  user: string;
  status: string;
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

export const TeacherInterfaceTemplates: FC = () => {
  const userName = useAuth.getState().userName;
  const { setJsonData, setTeacherTemplates } = useStore();
  const [templatesData, setTemplatesData] = useState<TemplateData[]>();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await axiosBase.post("find-teacher-templates", {
        userName,
      });
      setTemplatesData(response.data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [userName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (templatesData) {
      const templates = templatesData.map((row) => {
        return {
          id: row.id,
          text: row.disciplins_name,
          year: row.year,
        };
      });
      setTeacherTemplates(templates || []);
    }
  }, [templatesData, setTeacherTemplates]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: number) => {
    setAnchorEl(event.currentTarget);
    setSelectedTemplateId(id);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTemplateId(null);
  };

  const handleOpenTemplate = useCallback(
    (templateId: number) => {
      handleMenuClose();
      navigate(`${RedirectPath.TEMPLATES}/${templateId}`);
    },
    [navigate]
  );

  const columns = useMemo<MRT_ColumnDef<TemplateData>[]>(
    () => [
      {
        accessorKey: "statusIcon",
        header: "",
        Cell: ({ row }) => (
          <Box pl={1.5}>
            <StatusCell status={row.original.status.status} />
          </Box>
        ),
        enableColumnFilter: false,
        size: 10,
      },
      {
        accessorKey: "disciplins_name",
        header: "Название \nдисциплины",
        size: 10,
      },
      {
        accessorKey: "faculty",
        header: "Институт",
      },
      {
        accessorKey: "education_level",
        header: "Уровень \nобразования",
        size: 10,
      },
      {
        accessorKey: "direction",
        header: "Направление",
      },
      {
        accessorKey: "profile",
        header: "Профиль",
      },
      {
        accessorKey: "education_form",
        header: "Форма \n\n\n\n\n\nобучения",
        size: 10,
      },
      {
        accessorKey: "year",
        header: "Год набора",
        size: 10,
      },
      {
        accessorKey: "status",
        header: "Статус",
        Cell: ({ row }) => <TemplateStatus status={row.original.status} />,
      },
      {
        accessorKey: "action",
        header: "Действие",
        Cell: ({ row }) => {
          return row.original.status.status === TemplateStatusEnum.IN_PROGRESS ? (
            <>
              <IconButton onClick={(e) => handleMenuOpen(e, row.original.id)}>
                <MoreHorizIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl) && selectedTemplateId === row.original.id}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={() => handleOpenTemplate(row.original.id)}>
                  <ListItemIcon>
                    <FolderOpen fontSize="small" />
                  </ListItemIcon>
                  Открыть
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    setTemplateStatus(
                      {
                        id: row.original.id,
                        userName: userName,
                        status: TemplateStatusEnum.READY,
                      },
                      fetchData
                    )
                  }
                >
                  <ListItemIcon>
                    <CheckCircle fontSize="small" />
                  </ListItemIcon>
                  Готов
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={() =>
                setTemplateStatus(
                  {
                    id: row.original.id,
                    userName: userName,
                    status: TemplateStatusEnum.IN_PROGRESS,
                  },
                  fetchData
                )
              }
            >
              Взять в работу
            </Button>
          );
        },
      },
    ],
    [anchorEl, fetchData, selectedTemplateId, userName, handleOpenTemplate]
  );

  const table = useMaterialReactTable<TemplateData>({
    columns,
    data: templatesData || [],
    localization: MRT_Localization_RU,
    muiTableBodyCellProps: ({ column }) => ({
      sx: column.id === "mrt-row-select" ? { paddingRight: 0, paddingLeft: 0 } : { py: 0.5, px: 0.5 },
    }),
    muiTableHeadCellProps: ({ column }) => ({
      sx: column.id === "mrt-row-select" ? { paddingRight: 0, paddingLeft: 0 } : { py: 0.5, px: 0.5 },
    }),
  });

  if (!templatesData) return <Loader />;

  return (
    <Box>
      <CssBaseline />
      <PageTitle title={"Выбор РПД для редактирования"} />
      <Box py={2}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
};
