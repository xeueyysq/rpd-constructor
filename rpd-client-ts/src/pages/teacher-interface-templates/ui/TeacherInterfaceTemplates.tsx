import {
  getTemplateStatusLabel,
  participationLabels,
  TemplateStatus,
  useMyTemplates,
  type MyTemplate,
} from "@entities/template";
import { TemplateWorkflowActions } from "@features/template-workflow";
import { Box, Button, CssBaseline } from "@mui/material";
import { RedirectPath } from "@shared/enums";
import { Loader, PageTitle } from "@shared/ui";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export function TeacherInterfaceTemplates() {
  const { data, isLoading } = useMyTemplates();
  const navigate = useNavigate();
  const columns = useMemo<MRT_ColumnDef<MyTemplate>[]>(
    () => [
      { accessorKey: "disciplins_name", header: "Название дисциплины" },
      { accessorKey: "faculty", header: "Институт" },
      { accessorKey: "education_level", header: "Уровень образования" },
      { accessorKey: "direction", header: "Направление" },
      { accessorKey: "profile", header: "Профиль" },
      { accessorKey: "education_form", header: "Форма обучения" },
      { accessorKey: "year", header: "Год набора" },
      {
        id: "status",
        header: "Статус",
        accessorFn: (row) => getTemplateStatusLabel(row.status),
        Cell: ({ row }) => (
          <TemplateStatus
            status={row.original.status}
            progress={row.original.progress}
            participants={row.original.participants}
          />
        ),
      },
      {
        id: "myState",
        header: "Моя отметка",
        accessorFn: (row) => participationLabels[row.myState],
      },
      {
        id: "actions",
        header: "Действия",
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box>
            <Button
              size="small"
              onClick={() =>
                navigate(
                  `${RedirectPath.TEMPLATES}/${row.original.public_id ?? row.original.id}`
                )
              }
            >
              Открыть
            </Button>
            <TemplateWorkflowActions
              templateId={row.original.id}
              allowedActions={row.original.allowedActions}
            />
          </Box>
        ),
      },
    ],
    [navigate]
  );
  const table = useMaterialReactTable<MyTemplate>({
    columns,
    data: data ?? [],
    getRowId: (row) => String(row.id),
    localization: MRT_Localization_RU,
    enableColumnResizing: true,
    layoutMode: "grid",
    muiTableProps: { size: "small", className: "table" },
  });
  if (isLoading) return <Loader />;
  return (
    <Box>
      <CssBaseline />
      <PageTitle title="Выбор РПД для редактирования" />
      <Box sx={{ py: 2 }}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
