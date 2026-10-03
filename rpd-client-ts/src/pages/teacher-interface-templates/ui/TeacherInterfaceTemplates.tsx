import {
  getTemplateStatusLabel,
  participationLabels,
  TemplateHistoryDialog,
  useMyTemplates,
  useTemplateHistory,
  type MyTemplate,
} from "@entities/template";
import { TemplateWorkflowMenu } from "@features/template-workflow";
import { Box, CssBaseline, useTheme } from "@mui/material";
import { RedirectPath } from "@shared/enums";
import { useActionsColumn } from "@shared/hooks";
import { Loader, PageTitle, StatusWithDate } from "@shared/ui";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export function TeacherInterfaceTemplates() {
  const { data, isLoading } = useMyTemplates();
  const navigate = useNavigate();
  const theme = useTheme();
  const [historyTemplateId, setHistoryTemplateId] = useState<number | null>(
    null
  );
  const history = useTemplateHistory(historyTemplateId);
  const statusColumnWidth = Number.parseFloat(theme.spacing(26));
  const actionsColumn = useActionsColumn<MyTemplate>();
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
        size: statusColumnWidth,
        accessorFn: (row) => getTemplateStatusLabel(row.status),
        Cell: ({ row }) => (
          <StatusWithDate
            label={getTemplateStatusLabel(row.original.status)}
            date={row.original.statusChangedAt}
            note={`Моя отметка: ${participationLabels[row.original.myState]}`}
            onClick={() => setHistoryTemplateId(row.original.id)}
          />
        ),
      },
      {
        id: "actions",
        header: "Действия",
        ...actionsColumn,
        Cell: ({ row }) => (
          <TemplateWorkflowMenu
            templateId={row.original.id}
            allowedActions={row.original.allowedActions}
            onOpen={() =>
              navigate(
                `${RedirectPath.TEMPLATES}/${row.original.public_id ?? row.original.id}`
              )
            }
            onOpenHistory={() => setHistoryTemplateId(row.original.id)}
          />
        ),
      },
    ],
    [navigate, statusColumnWidth, actionsColumn]
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
      <TemplateHistoryDialog
        history={history.data ?? []}
        open={historyTemplateId != null}
        isPending={history.isPending}
        isError={history.isError}
        onClose={() => setHistoryTemplateId(null)}
      />
    </Box>
  );
}
