import { useAuth } from "@entities/auth";
import { useRpdComplectsQuery } from "@entities/rpd-complect";
import {
  ComplectCompetenciesDialog,
  type CompetenciesTarget,
} from "@features/complect-competencies";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import {
  Box,
  Breadcrumbs,
  Button,
  CssBaseline,
  Link,
  Typography,
} from "@mui/material";
import { UserRole } from "@shared/ability";
import { RedirectPath } from "@shared/enums";
import { useStore } from "@shared/hooks";
import type { ComplectData } from "@shared/types";
import {
  Loader,
  PageTitle,
  StatusWithDate,
  StatusWithSubtext,
} from "@shared/ui";
import { ComplectTableHeader } from "@widgets/table-header";
import { orderBy } from "lodash";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { FC, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { AssignOwnerDialog } from "./AssignOwnerDialog";

export const RpdComplectsList: FC = () => {
  const { setComplectId } = useStore();
  const [competenciesTarget, setCompetenciesTarget] =
    useState<CompetenciesTarget | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const userRole = useAuth.getState().userRole;
  const { complects, isLoading } = useRpdComplectsQuery();
  const ownerComplect = complects?.find(
    (complect) => complect.id === selectedOwnerId
  );

  const sortedComplectsByYear = useMemo(
    () => orderBy(complects, ["profile", "year"], ["asc", "asc"]),
    [complects]
  );

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
      ...(userRole === UserRole.ADMIN
        ? [
            {
              id: "owner",
              header: "Владелец",
              accessorFn: (row: ComplectData) =>
                row.owner?.map((owner) => owner.fullname).join(", ") ?? "",
              Cell: ({ row }: { row: { original: ComplectData } }) => {
                const open = () => setSelectedOwnerId(row.original.id);
                const owners = row.original.owner ?? [];
                // Оформление как у назначенных преподавателей в таблице комплекта.
                if (!owners.length)
                  return (
                    <StatusWithSubtext
                      label="Назначить РОП"
                      onClick={open}
                      underline
                    />
                  );
                return (
                  <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
                    {owners.map((owner) => (
                      <Box
                        component="li"
                        key={owner.userId}
                        sx={{ "& + &": { mt: (theme) => theme.spacing(1) } }}
                      >
                        <StatusWithSubtext
                          label={owner.fullname}
                          onClick={open}
                        />
                      </Box>
                    ))}
                  </Box>
                );
              },
            } as MRT_ColumnDef<ComplectData>,
          ]
        : []),
      {
        accessorKey: "profile",
        header: "Профиль",
        Cell: ({ row }) => (
          <Link
            component={RouterLink}
            to={`${RedirectPath.COMPLECTS}/${row.original.uuid}`}
            onClick={() => setComplectId(row.original.id)}
            sx={(theme) => ({ ...theme.typography.button })}
          >
            {row.original.profile}
          </Link>
        ),
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
        accessorKey: "status",
        header: "Статус",
        size: 120,
        Cell: ({ row }) => {
          if (!row.original.hasPendingChanges) return null;
          return (
            <StatusWithDate label="Обновлён" date={row.original.lastSyncedAt} />
          );
        },
      },
      {
        accessorKey: "actions",
        header: "",
        enableSorting: false,
        enableColumnActions: false,
        enableColumnFilter: false,
        minSize: 130,
        size: 140,
        grow: false,
        Cell: ({ row }) => (
          <Button
            size="medium"
            sx={{ textDecoration: "underline" }}
            onClick={() => {
              const originalRow = row.original;
              setCompetenciesTarget({
                id: originalRow.id,
                label: `${originalRow.directionOfStudy} • ${originalRow.profile} • ${originalRow.year} • ${originalRow.formEducation}`,
              });
            }}
          >
            Компетенции
          </Button>
        ),
      },
    ],
    [setComplectId, userRole]
  );

  const table = useMaterialReactTable<ComplectData>({
    columns: generalColumns,
    data: userRole === UserRole.ADMIN ? complects : sortedComplectsByYear,
    getRowId: (row) => String(row.id),
    localization: MRT_Localization_RU,
    enableFilters: false,
    enableSorting: false,
    enableRowSelection: true,
    enableColumnResizing: true,
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
    renderTopToolbarCustomActions: ({ table }) => (
      <ComplectTableHeader setRowSelection={setRowSelection} table={table} />
    ),
  });

  if (isLoading) return <Loader />;

  return (
    <Box>
      <CssBaseline />
      <PageTitle title={"Список загруженных комплектов РПД"} />
      <Box sx={{ py: 0.5 }}>
        {sortedComplectsByYear.length > 0 && userRole !== UserRole.ADMIN && (
          <Breadcrumbs
            separator={
              <FiberManualRecordIcon color="secondary" sx={{ fontSize: 5 }} />
            }
          >
            {[
              <Typography component={"span"} color="textSecondary">
                {sortedComplectsByYear[0].directionOfStudy}
              </Typography>,
              <Typography component={"span"} color="textSecondary">
                {sortedComplectsByYear[0].levelEducation}
              </Typography>,
            ]}
          </Breadcrumbs>
        )}
      </Box>
      <Box sx={{ pt: 2 }}>
        <MaterialReactTable table={table} />
      </Box>
      {ownerComplect ? (
        <AssignOwnerDialog
          complect={ownerComplect}
          onClose={() => setSelectedOwnerId(null)}
        />
      ) : null}
      <ComplectCompetenciesDialog
        complect={competenciesTarget}
        onClose={() => setCompetenciesTarget(null)}
      />
    </Box>
  );
};
