import {
  getTemplateStatusLabel,
  participationLabels,
  TemplateHistoryDialog,
  useMyTemplates,
  useTemplateHistory,
  type MyTemplate,
} from "@entities/template";
import { TemplateWorkflowMenu } from "@features/template-workflow";
import { SourcePickerDialog } from "@features/template-import";
import { Box, CssBaseline, Link, useTheme } from "@mui/material";
import { RedirectPath, TemplatePagesPath } from "@shared/enums";
import { useRowContextMenu } from "@shared/hooks";
import { Loader, PageTitle, StatusWithDate } from "@shared/ui";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

export function TeacherInterfaceTemplates() {
  const { data, isLoading } = useMyTemplates();
  const navigate = useNavigate();
  const theme = useTheme();
  const [historyTemplateId, setHistoryTemplateId] = useState<number | null>(
    null
  );
  const history = useTemplateHistory(historyTemplateId);
  const [importTemplateId, setImportTemplateId] = useState<number | null>(null);
  const importTemplate = data?.find((row) => row.id === importTemplateId);
  const statusColumnWidth = Number.parseFloat(theme.spacing(26));
  const contextMenu = useRowContextMenu();
  const menuRow = data?.find((row) => row.id === contextMenu.target?.id);
  const columns = useMemo<MRT_ColumnDef<MyTemplate>[]>(
    () => [
      {
        accessorKey: "disciplins_name",
        header: "Название дисциплины",
        filterFn: "contains",
        Cell: ({ row }) => (
          <Link
            component={RouterLink}
            to={`${RedirectPath.TEMPLATES}/${row.original.public_id ?? row.original.id}/${TemplatePagesPath.COVER_PAGE}`}
            sx={(theme) => ({ ...theme.typography.button })}
          >
            {row.original.disciplins_name}
          </Link>
        ),
      },
      {
        id: "participants",
        header: "Преподаватели",
        filterFn: "contains",
        accessorFn: (row) =>
          row.participants
            .map((participant) => participant.fullname)
            .join(", "),
      },
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
    ],
    [statusColumnWidth]
  );
  const table = useMaterialReactTable<MyTemplate>({
    columns,
    data: data ?? [],
    getRowId: (row) => String(row.id),
    localization: MRT_Localization_RU,
    globalFilterFn: "contains",
    enableColumnResizing: true,
    layoutMode: "grid",
    muiTableProps: { size: "small", className: "table" },
    muiTableBodyRowProps: ({ row }) => contextMenu.rowProps(row.original.id),
  });
  if (isLoading) return <Loader />;
  return (
    <Box>
      <CssBaseline />
      <PageTitle title="Выбор РПД для редактирования" />
      <Box sx={{ py: 2 }}>
        <MaterialReactTable table={table} />
      </Box>
      {menuRow ? (
        <TemplateWorkflowMenu
          key={menuRow.id}
          position={contextMenu.target?.position ?? null}
          onClose={contextMenu.close}
          templateId={menuRow.id}
          allowedActions={menuRow.allowedActions}
          onOpen={() =>
            navigate(
              `${RedirectPath.TEMPLATES}/${menuRow.public_id ?? menuRow.id}`
            )
          }
          onOpenHistory={() => setHistoryTemplateId(menuRow.id)}
          onImport={
            menuRow.status !== "ready" &&
            menuRow.allowedActions.some((action) =>
              ["start", "finish", "reopen"].includes(action)
            )
              ? () => setImportTemplateId(menuRow.id)
              : undefined
          }
        />
      ) : null}
      <TemplateHistoryDialog
        history={history.data ?? []}
        open={historyTemplateId != null}
        isPending={history.isPending}
        isError={history.isError}
        onClose={() => setHistoryTemplateId(null)}
      />
      {importTemplate ? (
        <SourcePickerDialog
          key={importTemplate.id}
          open
          targetTemplateId={importTemplate.id}
          targetLabel={`${importTemplate.disciplins_name} • ${importTemplate.profile} • ${importTemplate.year}`}
          onClose={() => setImportTemplateId(null)}
        />
      ) : null}
    </Box>
  );
}
