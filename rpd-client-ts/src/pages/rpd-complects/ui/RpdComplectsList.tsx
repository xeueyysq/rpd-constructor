import CachedIcon from "@mui/icons-material/Cached";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { Box, Breadcrumbs, Button, CssBaseline } from "@mui/material";
import { axiosBase } from "@shared/api";
import { RedirectPath } from "@shared/enums";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showWarningMessage } from "@shared/lib";
import type { ComplectData } from "@shared/types";
import { Loader, PageTitle } from "@shared/ui";
import { WarningDeleteDialog } from "@widgets/dialogs/ui";
import { orderBy } from "lodash";
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export const RpdComplectsList: FC = () => {
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);
  const [complects, setComplects] = useState<ComplectData[]>([]);
  const [loading, setLoading] = useState(true);
  const { setComplectId } = useStore();
  const navigate = useNavigate();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchComplects();
  }, []);

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
    (complect: ComplectData) => {
      navigate(`${RedirectPath.COMPLECTS}/${complect.id}`);
      setComplectId(complect.id);
    },
    [setComplectId, navigate]
  );

  const sortedComplectsByYear = useMemo(() => orderBy(complects, ["profile", "year"], ["asc", "asc"]), [complects]);

  const columns = useMemo<MRT_ColumnDef<ComplectData>[]>(
    () => [
      {
        accessorKey: "profile",
        header: "Профиль",
        Cell: ({ table, row }) => {
          const rows = table.getRowModel().rows;
          const prev = rows[row.index - 1];
          return prev && prev.original.profile === row.original.profile ? null : row.original.profile;
        },
      },
      {
        accessorKey: "formEducation",
        header: "Форма обучения",
        size: 30,
      },
      {
        accessorKey: "year",
        header: "Год набора",
        size: 20,
      },
      {
        accessorKey: "actions",
        header: "",
        enableSorting: false,
        enableColumnActions: false,
        enableColumnFilter: false,
        size: 200,
        Cell: ({ row }) => (
          <Breadcrumbs separator={"/"}>
            {[
              <Button sx={{ textDecoration: "underline" }} onClick={() => handleViewComplect(row.original)}>
                Комплект рпд
              </Button>,
              <Button
                sx={{ textDecoration: "underline" }}
                onClick={() => {
                  const originalRow = row.original;
                  navigate(RedirectPath.PLANNED_RESULTS, {
                    state: {
                      profile: originalRow.profile,
                      formEducation: originalRow.formEducation,
                      year: originalRow.year,
                    },
                  });
                }}
              >
                Компетенции
              </Button>,
            ]}
          </Breadcrumbs>
        ),
      },
    ],
    [handleViewComplect, navigate]
  );

  const table = useMaterialReactTable<ComplectData>({
    columns,
    data: sortedComplectsByYear,
    localization: MRT_Localization_RU,
    enableFilters: false,
    enableSorting: false,
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
    renderTopToolbarCustomActions: ({ table }) => {
      const selectedRowsCount = Object.values(table.getState().rowSelection).length;
      return (
        <Box
          sx={{
            display: "flex",
            px: 1.5,
            pt: 0.5,
            gap: "12px",
          }}
        >
          <Button
            variant="contained"
            startIcon={<CachedIcon />}
            onClick={() => {
              if (!selectedRowsCount) showWarningMessage("Выберите комплект для обновления");
            }}
          >
            Обновить комплект
          </Button>
          {!!selectedRowsCount && <Button color="error">Удалить</Button>}
        </Box>
      );
    },
    positionToolbarAlertBanner: "none",
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });

  if (loading) return <Loader />;

  const handleConfirm = async () => {
    const currentSelectedIds = Object.keys(rowSelection).map((id) => sortedComplectsByYear[Number(id)].id);
    setOpenDeleteConfirm(false);
    await deleteComplect(currentSelectedIds);
  };

  return (
    <Box>
      <CssBaseline />
      <PageTitle title={"Список загруженных комплектов РПД"} />
      <Box py={1}>
        <Breadcrumbs separator={<FiberManualRecordIcon sx={{ fontSize: 5 }} />}>
          {[
            <span>{sortedComplectsByYear[0].directionOfStudy}</span>,
            <span>{sortedComplectsByYear[0].levelEducation}</span>,
          ]}
        </Breadcrumbs>
      </Box>
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
