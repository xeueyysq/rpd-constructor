import { getTemplateStatusLabel, TemplateStatus } from "@entities/template";
import { AssignTeachers } from "@features/assign-teachers";
import { ExchangeChanges } from "@features/complect-sync";
import { TemplateWorkflowActions } from "@features/template-workflow";
import { Box, Button } from "@mui/material";
import type { MRT_ColumnDef } from "material-react-table";
import { useMemo } from "react";
import TemplateMenu from "../ui/TemplateMenu";
import type { TemplateData } from "../types";

type Params = {
  selectedTeacherIds: Record<number, number[]>;
  onSelectedTeacherIdsChange: (exchangeId: number, ids: number[]) => void;
  onCreateTemplate: (id: number) => Promise<void>;
  onFetchData: () => Promise<void>;
};

export function useComplectTableColumns({
  selectedTeacherIds,
  onSelectedTeacherIdsChange,
  onCreateTemplate,
  onFetchData,
}: Params): MRT_ColumnDef<TemplateData>[] {
  return useMemo(
    () => [
      { accessorKey: "discipline", header: "Дисциплина" },
      { accessorKey: "semester", header: "Семестр", size: 100 },
      {
        id: "participants",
        header: "Преподаватели",
        accessorFn: (row) =>
          row.participants.map((part) => part.fullname).join(", "),
        Cell: ({ row }) => (
          <AssignTeachers
            templateId={row.original.id_profile_template}
            status={row.original.status}
            participants={row.original.participants}
            hints={row.original.teacherHints}
            canEditTeachers={row.original.canEditTeachers}
            selectedIds={selectedTeacherIds[row.original.id] ?? []}
            onSelectedIdsChange={(ids) =>
              onSelectedTeacherIdsChange(row.original.id, ids)
            }
            onRefresh={onFetchData}
          />
        ),
      },
      {
        id: "status",
        header: "Статус",
        accessorFn: (row) => getTemplateStatusLabel(row.status),
        Cell: ({ row }) => (
          <TemplateStatus
            status={row.original.status}
            progress={
              row.original.id_profile_template
                ? row.original.progress
                : undefined
            }
            participants={row.original.participants}
          />
        ),
      },
      {
        id: "sync",
        header: "1С",
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <ExchangeChanges
            exchangeId={row.original.id}
            pendingChanges={row.original.pendingChanges}
            onAcknowledged={onFetchData}
          />
        ),
      },
      {
        id: "actions",
        header: "Действия",
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box>
            {row.original.id_profile_template ? (
              <>
                <TemplateMenu
                  id={row.original.id_profile_template}
                  publicId={row.original.profile_template_public_id}
                  fetchData={onFetchData}
                />
                <TemplateWorkflowActions
                  templateId={row.original.id_profile_template}
                  allowedActions={row.original.allowedActions}
                  onChanged={onFetchData}
                />
              </>
            ) : (
              <Button
                variant="contained"
                onClick={() => void onCreateTemplate(row.original.id)}
              >
                Создать
              </Button>
            )}
          </Box>
        ),
      },
    ],
    [
      selectedTeacherIds,
      onSelectedTeacherIdsChange,
      onCreateTemplate,
      onFetchData,
    ]
  );
}
