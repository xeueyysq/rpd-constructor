import { getTemplateStatusLabel } from "@entities/template";
import { AssignTeachers } from "@features/assign-teachers";
import { ExchangeChanges } from "@features/complect-sync";
import { Box } from "@mui/material";
import { useActionsColumn } from "@shared/hooks";
import { StatusWithDate } from "@shared/ui";
import type { MRT_ColumnDef } from "material-react-table";
import { useMemo } from "react";
import TemplateMenu from "../ui/TemplateMenu";
import type { TemplateData } from "../types";

type Params = {
  selectedTeacherIds: Record<number, number[]>;
  onCreateTemplate: (id: number) => Promise<void>;
  onFetchData: () => Promise<void>;
  onOpenTeachers: (exchangeId: number) => void;
  onOpenHistory: (templateId: number) => void;
};

export function useComplectTableColumns({
  selectedTeacherIds,
  onCreateTemplate,
  onFetchData,
  onOpenTeachers,
  onOpenHistory,
}: Params): MRT_ColumnDef<TemplateData>[] {
  const actionsColumn = useActionsColumn<TemplateData>();
  return useMemo(
    () => [
      { accessorKey: "discipline", header: "Дисциплина" },
      { accessorKey: "semester", header: "Семестр", size: 100, grow: false },
      {
        id: "participants",
        header: "Преподаватели",
        minSize: 240,
        size: 280,
        accessorFn: (row) =>
          row.participants.map((part) => part.fullname).join(", "),
        Cell: ({ row }) => (
          <AssignTeachers
            templateId={row.original.id_profile_template}
            status={row.original.status}
            participants={row.original.participants}
            canEditTeachers={row.original.canEditTeachers}
            selectedIds={selectedTeacherIds[row.original.id] ?? []}
            onOpen={() => onOpenTeachers(row.original.id)}
          />
        ),
      },
      {
        id: "status",
        header: "Статус",
        accessorFn: (row) => getTemplateStatusLabel(row.status),
        Cell: ({ row }) => (
          <Box>
            <StatusWithDate
              label={getTemplateStatusLabel(row.original.status)}
              date={row.original.statusChangedAt}
              onClick={
                row.original.id_profile_template != null
                  ? () => onOpenHistory(row.original.id_profile_template!)
                  : undefined
              }
            />
            <Box
              sx={{
                mt: (theme) =>
                  row.original.latestChanges.count ? theme.spacing(1) : 0,
              }}
            >
              <ExchangeChanges
                exchangeId={row.original.id}
                latestChanges={row.original.latestChanges}
              />
            </Box>
          </Box>
        ),
      },
      {
        id: "actions",
        header: "Действия",
        ...actionsColumn,
        Cell: ({ row }) => (
          <TemplateMenu
            id={row.original.id_profile_template}
            publicId={row.original.profile_template_public_id}
            allowedActions={row.original.allowedActions}
            fetchData={onFetchData}
            canEditTeachers={row.original.canEditTeachers}
            onEditTeachers={() => onOpenTeachers(row.original.id)}
            onOpenHistory={() => {
              if (row.original.id_profile_template != null)
                onOpenHistory(row.original.id_profile_template);
            }}
            onCreateTemplate={() => onCreateTemplate(row.original.id)}
          />
        ),
      },
    ],
    [
      actionsColumn,
      selectedTeacherIds,
      onCreateTemplate,
      onFetchData,
      onOpenTeachers,
      onOpenHistory,
    ]
  );
}
