import { TemplateStatus, TemplateStatusEnum } from "@entities/template";
import { Autocomplete, Box, Button, TextField } from "@mui/material";
import type { MRT_ColumnDef } from "material-react-table";
import { useMemo } from "react";
import TemplateMenu from "../ui/TemplateMenu";
import type { TemplateData } from "../types";
import type { SelectedTeachersMap } from "./useComplectData";

function parseTeacherString(teacher: string | undefined): string[] {
  if (!teacher?.trim()) return [];
  return teacher
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

type UseComplectTableColumnsParams = {
  selectedTeachers: SelectedTeachersMap;
  onTeachersChange: (templateId: number, value: string[]) => void;
  onCreateTemplate: (id: number, discipline: string) => Promise<void>;
  onFetchData: () => Promise<void>;
};

export function useComplectTableColumns({
  selectedTeachers,
  onTeachersChange,
  onCreateTemplate,
  onFetchData,
}: UseComplectTableColumnsParams): MRT_ColumnDef<TemplateData>[] {
  return useMemo(
    () => [
      {
        accessorKey: "discipline",
        header: "Дисциплина",
      },
      {
        accessorKey: "semester",
        header: "Семестр",
        size: 100,
      },
      {
        accessorKey: "teacher",
        header: "Преподаватель",
        Cell: ({ row }) => (
          <Box width="100%">
            <Autocomplete
              id={`select-${row.original.id}`}
              multiple
              value={
                selectedTeachers[row.original.id] ??
                parseTeacherString(row.original.teacher)
              }
              onChange={(_, value) => onTeachersChange(row.original.id, value)}
              fullWidth
              renderInput={(params) => (
                <TextField
                  label="Преподаватель"
                  variant="standard"
                  {...params}
                />
              )}
              options={row.original.teachers}
            />
          </Box>
        ),
      },
      {
        accessorKey: "status",
        header: "Статус",
        Cell: ({ row }) => (
          <Box>
            <TemplateStatus status={row.original.status} />
          </Box>
        ),
      },
      {
        accessorKey: "choise",
        header: "Действие",
        size: 100,
        Cell: ({ row }) => (
          <Box>
            {row.original.status.status === TemplateStatusEnum.UNLOADED ? (
              <Button
                variant="contained"
                onClick={() =>
                  onCreateTemplate(row.original.id, row.original.discipline)
                }
              >
                Создать
              </Button>
            ) : (
              <TemplateMenu
                id={row.original.id_profile_template}
                teacher={(
                  selectedTeachers[row.original.id] ??
                  parseTeacherString(row.original.teacher)
                ).join(", ")}
                status={row.original.status.status}
                fetchData={onFetchData}
              />
            )}
          </Box>
        ),
      },
    ],
    [selectedTeachers, onTeachersChange, onCreateTemplate, onFetchData]
  );
}
