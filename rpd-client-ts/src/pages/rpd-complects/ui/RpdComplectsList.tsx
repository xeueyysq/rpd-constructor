import { useAuth } from "@entities/auth";
import { useRpdComplectsQuery, useDeleteRpdComplectsMutation } from "@entities/rpd-complect/model/queries";
import CachedIcon from "@mui/icons-material/Cached";
import DeleteIcon from "@mui/icons-material/Delete";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { Box, Breadcrumbs, Button, CssBaseline } from "@mui/material";
import { UserRole } from "@shared/ability";
import { RedirectPath } from "@shared/enums";
import { useStore } from "@shared/hooks";
import type { ComplectData } from "@shared/types";
import { Loader, PageTitle } from "@shared/ui";
import { WarningDeleteDialog } from "@widgets/dialogs/ui";
import { orderBy } from "lodash";
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { FC, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export const RpdComplectsList: FC = () => {
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState<boolean>(false);
  const { setComplectId } = useStore();
  const navigate = useNavigate();
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const userRole = useAuth.getState().userRole;
  const { complects, isLoading } = useRpdComplectsQuery();
  const deleteMutation = useDeleteRpdComplectsMutation();

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

  const table = useMaterialReactTable<ComplectData>({
    columns: generalColumns,
    data: userRole === UserRole.ADMIN ? complects : sortedComplectsByYear,
    localization: MRT_Localization_RU,
    enableFilters: false,
    enableSorting: false,
    enableRowSelection: true,
    positionToolbarAlertBanner: "none",
    layoutMode: "grid",
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 20,
      },
    },
    muiTableProps: {
      size: "small",
      className: "table",
    },
    muiTableBodyCellProps: {
      sx: {
        py: 0.5,
      },
    },
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

  if (isLoading) return <Loader />;

  const handleConfirmDeletion = async () => {
    const ids = table.getSelectedRowModel().rows.map((r) => r.original.id);
    setOpenDeleteConfirm(false);
    setRowSelection({});
    await deleteMutation.mutateAsync(ids);
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
        <MaterialReactTable table={table} />
      </Box>
      <WarningDeleteDialog
        open={openDeleteConfirm}
        setOpen={setOpenDeleteConfirm}
        onAccept={handleConfirmDeletion}
        description={"Вы уверены, что хотите удалить выбранные комплекты?"}
      />
    </Box>
  );
};
