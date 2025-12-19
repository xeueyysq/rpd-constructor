import { useAuth } from "@entities/auth";
import CachedIcon from "@mui/icons-material/Cached";
import DeleteIcon from "@mui/icons-material/Delete";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { Box, Breadcrumbs, Button, CssBaseline } from "@mui/material";
import { UserRole } from "@shared/ability";
import { axiosBase } from "@shared/api";
import { RedirectPath } from "@shared/enums";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib";
import type { ComplectData } from "@shared/types";
import { Loader, PageTitle } from "@shared/ui";
import { WarningDeleteDialog } from "@widgets/dialogs/ui";
import { orderBy } from "lodash";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_TableOptions,
} from "material-react-table";
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
  const userRole = useAuth.getState().userRole;

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
      await axiosBase.post("delete_rpd_complect", ids);
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

  const adminColumns = [
    {
      accessorKey: "faculty",
      header: "Институт",
    },
    {
      accessorKey: "levelEducation",
      header: "Уровень \nобразования",
      size: 90,
    },
    {
      accessorKey: "directionOfStudy",
      header: "Направление",
    },
  ];

  const generalColumns = useMemo<MRT_ColumnDef<ComplectData>[]>(
    () => [
      ...(userRole === UserRole.ADMIN ? adminColumns : []),
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
        size: 110,
      },
      {
        accessorKey: "year",
        header: "Год набора",
        size: 100,
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
              <Button
                size="medium"
                sx={{ textDecoration: "underline" }}
                onClick={() => handleViewComplect(row.original)}
              >
                Комплект РПД
              </Button>,
              <Button
                size="medium"
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

  const generalTable = useMaterialReactTable<ComplectData>({
    columns: generalColumns,
    data: userRole === UserRole.ADMIN ? complects : sortedComplectsByYear,
    localization: MRT_Localization_RU,
    enableFilters: false,
    enableSorting: false,
    enableRowSelection: true,
    positionToolbarAlertBanner: "none",
    layoutMode: userRole === UserRole.ADMIN ? "grid" : "semantic",
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    muiTableProps: {
      size: "small",
      sx: { px: 2 },
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 20,
      },
    },
    muiTableHeadCellProps: {
      sx: {
        backgroundColor: "#eceff1",
      },
    },
    muiTableBodyCellProps: ({ row }) => ({
      sx: {
        py: 0.5,
        backgroundColor: row.index % 2 === 0 ? undefined : "#fafafa",
      },
    }),
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
            variant="outlined"
            startIcon={<CachedIcon />}
            disabled={!selectedRowsCount}
            sx={{ alignSelf: "flex-start" }}
          >
            Обновить комплект
          </Button>
          {
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              disabled={!selectedRowsCount}
              color="error"
              onClick={() => setOpenDeleteConfirm(true)}
            >
              Удалить
            </Button>
          }
        </Box>
      );
    },
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
      <Box py={0.5}>
        {sortedComplectsByYear.length > 0 && userRole !== UserRole.ADMIN && (
          <Breadcrumbs sx={{ color: "gray" }} separator={<FiberManualRecordIcon sx={{ fontSize: 5 }} />}>
            {[
              <span>{sortedComplectsByYear[0].directionOfStudy}</span>,
              <span>{sortedComplectsByYear[0].levelEducation}</span>,
            ]}
          </Breadcrumbs>
        )}
      </Box>
      <Box pt={2}>
        <MaterialReactTable table={generalTable} />
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
