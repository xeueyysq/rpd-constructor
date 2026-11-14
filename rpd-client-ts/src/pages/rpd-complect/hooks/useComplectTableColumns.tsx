import { getTemplateStatusLabel } from "@entities/template";
import { AssignTeachers } from "@features/assign-teachers";
import { ExchangeChanges } from "@features/complect-sync";
import { Box, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { RedirectPath, TemplatePagesPath } from "@shared/enums";
import { StatusWithDate } from "@shared/ui";
import type { MRT_ColumnDef } from "material-react-table";
import { useMemo } from "react";
import type { TemplateData } from "../types";

const disciplineCollator = new Intl.Collator("ru");

type Params = {
  onOpenTeachers: (exchangeId: number) => void;
  onOpenHistory: (templateId: number) => void;
};

export function useComplectTableColumns({
  onOpenTeachers,
  onOpenHistory,
}: Params): MRT_ColumnDef<TemplateData>[] {
  return useMemo(
    () => [
      {
        accessorKey: "discipline",
        header: "Дисциплина",
        filterFn: "contains",
        Cell: ({ row }) =>
          row.original.id_profile_template != null ? (
            <Link
              component={RouterLink}
              to={`${RedirectPath.TEMPLATES}/${row.original.profile_template_public_id ?? row.original.id_profile_template}/${TemplatePagesPath.COVER_PAGE}`}
              sx={(theme) => ({ ...theme.typography.button })}
            >
              {row.original.discipline}
            </Link>
          ) : (
            row.original.discipline
          ),
        sortingFn: (a, b) =>
          disciplineCollator.compare(
            a.original.discipline,
            b.original.discipline
          ) || a.original.id - b.original.id,
      },
      {
        accessorKey: "semester",
        header: "Семестр",
        minSize: 140,
        size: 160,
        grow: false,
      },
      {
        id: "participants",
        header: "Преподаватели",
        enableSorting: false,
        filterFn: "contains",
        minSize: 220,
        size: 240,
        maxSize: 260,
        grow: false,
        accessorFn: (row) =>
          row.participants.map((part) => part.fullname).join(", "),
        Cell: ({ row }) => (
          <AssignTeachers
            templateId={row.original.id_profile_template}
            status={row.original.status}
            participants={row.original.participants}
            canEditTeachers={row.original.canEditTeachers}
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
    ],
    [onOpenTeachers, onOpenHistory]
  );
}
