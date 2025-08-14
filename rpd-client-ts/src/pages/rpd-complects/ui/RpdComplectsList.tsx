import { FC, useEffect, useState, useMemo, useCallback } from "react";
import { Box, Button } from "@mui/material";
import { axiosBase } from "@shared/api";
import { Loader } from "@shared/ui";
import { useStore } from "@shared/hooks";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { showErrorMessage } from "@shared/lib";
import type { RpdComplect } from "../model";
import { CreateRpdTemplateFrom1CExchange } from "@features/create-rpd-template-from-1c-exchange";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";

export const RpdComplectsList: FC = () => {
  const [complects, setComplects] = useState<RpdComplect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
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

  const handleViewComplect = useCallback(
    (complect: RpdComplect) => {
      setSelectedTemplateData(
        complect.faculty,
        complect.levelEducation,
        complect.directionOfStudy,
        complect.profile,
        complect.formEducation,
        complect.year
      );
      setComplectId(complect.id);
      setShowTemplates(true);
    },
    [setComplectId, setSelectedTemplateData]
  );

  const columns = useMemo<MRT_ColumnDef<RpdComplect>[]>(
    () => [
      {
        accessorKey: "faculty",
        header: "Институт",
      },
      {
        accessorKey: "levelEducation",
        header: "Уровень \nобразования",
        size: 10,
      },
      {
        accessorKey: "directionOfStudy",
        header: "Направление",
      },
      {
        accessorKey: "profile",
        header: "Профиль",
      },
      {
        accessorKey: "formEducation",
        header: "Форма обучения",
        size: 10,
      },
      {
        accessorKey: "year",
        header: "Год набора",
        size: 10,
      },
      {
        accessorKey: "action",
        header: "Действие",
        Cell: ({ row }) => (
          <Button
            variant="contained"
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => handleViewComplect(row.original)}
          >
            Просмотр
          </Button>
        ),
      },
    ],
    [handleViewComplect]
  );

  const table = useMaterialReactTable<RpdComplect>({
    columns,
    data: complects,
    localization: MRT_Localization_RU,
  });

  if (loading) return <Loader />;

  if (showTemplates) {
    return (
      <CreateRpdTemplateFrom1CExchange
        setChoise={() => setShowTemplates(false)}
      />
    );
  }

  return (
    <Box pl={3}>
      <Box component="h2" sx={{ py: 1 }}>
        Список загруженных комплектов РПД
      </Box>
      <Box py={2}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
};
