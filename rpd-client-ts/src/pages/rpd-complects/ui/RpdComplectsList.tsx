import { CreateRpdTemplateFrom1CExchange } from "@features/create-rpd-template-from-1c-exchange";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Box, Button, CssBaseline, Paper } from "@mui/material";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import type { BasicComplectData } from "@shared/types";
import { Loader } from "@shared/ui";
import { WarningDeleteDialog } from "@widgets/dialogs/ui";
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageTitle } from "@shared/ui";

export const RpdComplectsList: FC = () => {
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);
  const [complects, setComplects] = useState<BasicComplectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const { setComplectId, setSelectedTemplateData } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchComplects();
  }, []);

  useEffect(() => {
    setShowTemplates(Boolean(location.hash));
  }, [location.hash]);

  const fetchComplects = async () => {
    try {
      const response = await axiosBase.get("get-rpd-complects");
      setComplects(response.data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deleteComplect = async (ids: number[]) => {
    try {
      const response = await axiosBase.post("delete_rpd_complect", ids);
      setRowSelection({});
      await fetchComplects();
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewComplect = useCallback(
    (complect: BasicComplectData) => {
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

      const hashFragment = `${complect.profile} ${complect.year}`;
      navigate(`/complects#${encodeURIComponent(hashFragment)}`);
    },
    [setComplectId, setSelectedTemplateData, navigate]
  );

  const columns = useMemo<MRT_ColumnDef<BasicComplectData>[]>(
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
          <Button variant="contained" startIcon={<VisibilityIcon />} onClick={() => handleViewComplect(row.original)}>
            Просмотр
          </Button>
        ),
      },
    ],
    [handleViewComplect]
  );

  const table = useMaterialReactTable<BasicComplectData>({
    columns,
    data: complects,
    localization: MRT_Localization_RU,
    muiTableProps: {
      size: "small",
      sx: { px: 2 },
    },
    muiTableBodyCellProps: ({ column }) => ({
      sx: column.id === "mrt-row-select" ? { paddingRight: 0, paddingLeft: 0 } : { py: 0.5, px: 0.5 },
    }),
    muiTableHeadCellProps: ({ column }) => ({
      sx: column.id === "mrt-row-select" ? { paddingRight: 0, paddingLeft: 0 } : { py: 0.5, px: 0.5 },
    }),
    enableRowSelection: true,
    renderToolbarAlertBannerContent: ({ table }) => (
      <Box
        sx={{
          display: "flex",
          px: 2,
          gap: "8px",
        }}
      >
        <Button onClick={() => table.resetRowSelection()}>Очистить выбор</Button>

        <Button color="error" onClick={() => setOpenDeleteConfirm(true)}>
          Удалить
        </Button>
      </Box>
    ),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });

  if (loading) return <Loader />;

  if (showTemplates) {
    return <CreateRpdTemplateFrom1CExchange setChoise={() => setShowTemplates(false)} />;
  }

  const handleConfirm = async () => {
    const currentSelectedIds = Object.keys(rowSelection).map((id) => complects[Number(id)].id);
    setOpenDeleteConfirm(false);
    await deleteComplect(currentSelectedIds);
  };

  return (
    <Box>
      <CssBaseline />
      <PageTitle title={"Список загруженных комплектов РПД"} />
      <Box pt={2}>
        <MaterialReactTable table={table} />
      </Box>
      <WarningDeleteDialog
        open={openDeleteConfirm}
        setOpen={setOpenDeleteConfirm}
        onAccept={handleConfirm}
        description={"Вы уверены, что хотите удалить выбранные комплекты?"}
      />
    </Box>
  );
};
