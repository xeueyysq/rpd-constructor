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
  onCreateTemplate: (id: number) => Promise<void>;
  onFetchData: () => Promise<void>;
  onOpenTeachers: (exchangeId: number) => void;
};

export function useComplectTableColumns({
  selectedTeacherIds,
  onCreateTemplate,
  onFetchData,
  onOpenTeachers,
}: Params): MRT_ColumnDef<TemplateData>[] {
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
            <TemplateStatus
              status={row.original.status}
              progress={
                row.original.id_profile_template
                  ? row.original.progress
                  : undefined
              }
            />
            <Box sx={{ mt: row.original.pendingChanges.count ? 0.5 : 0 }}>
              <ExchangeChanges
                exchangeId={row.original.id}
                pendingChanges={row.original.pendingChanges}
                onAcknowledged={onFetchData}
              />
            </Box>
          </Box>
        ),
      },
      {
        id: "actions",
        header: "Действия",
        size: 240,
        minSize: 240,
        grow: false,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "nowrap",
            }}
          >
            {row.original.id_profile_template ? (
              <>
                <TemplateMenu
                  id={row.original.id_profile_template}
                  publicId={row.original.profile_template_public_id}
                  fetchData={onFetchData}
                  canEditTeachers={row.original.canEditTeachers}
                  onEditTeachers={() => onOpenTeachers(row.original.id)}
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
    [selectedTeacherIds, onCreateTemplate, onFetchData, onOpenTeachers]
  );
}
