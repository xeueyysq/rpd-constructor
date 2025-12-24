import { useAuth } from "@entities/auth";
import { TemplateStatus, TemplateStatusEnum } from "@entities/template";
import { Box, Button, FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showSuccessMessage, showWarningMessage } from "@shared/lib";
import { Loader } from "@shared/ui";
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import TemplateMenu from "./TemplateMenu.tsx";
import { PageTitle } from "@shared/ui";
import { useParams } from "react-router-dom";
import { ComplectData } from "@shared/types/complect.ts";
import { RedirectPath } from "@shared/enums.ts";

interface TemplateStatusObject {
  date: string;
  status: string;
  user: string;
}

interface TemplateData {
  id: number;
  id_profile_template: number;
  discipline: string;
  teachers: string[];
  teacher: string;
  semester: number;
  status: TemplateStatusObject;
}

type ComplectMeta = ComplectData & {
  templates: TemplateData[];
};

export interface CreateTemplateDataParams {
  id_1c: number;
  complectId: number | undefined;
  teacher: string;
  year: string | undefined;
  discipline: string;
  userName: string | undefined;
}

export function RpdComplectPage() {
  const selectedTemplateData = useStore.getState().selectedTemplateData;
  const { id } = useParams();
  const complectId = Number(id);
  const [complectMeta, setComplectMeta] = useState<ComplectMeta>();
  const complectTemplates = complectMeta?.templates;
  const [selectedTeachers, setSelectedTeachers] = useState<{
    [key: number]: string;
  }>({});
  const userName = useAuth.getState().userName;

  const fetchComplectData = useCallback(async () => {
    try {
      const response = await axiosBase.post("find-rpd", { complectId });
      setComplectMeta(response.data);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [complectId]);

  useEffect(() => {
    fetchComplectData();
  }, [fetchComplectData]);

  const handleFilteredData = useCallback(() => {
    if (complectTemplates) {
      return complectTemplates.sort((a, b) => {
        const priority: Record<string, number> = {
          [TemplateStatusEnum.UNLOADED]: 1,
        };
        return (priority[a.status.status] || 0) - (priority[b.status.status] || 0);
      });
    }
    return [];
  }, [complectTemplates]);

  const handleChange = useCallback(
    (templateId: number) => (event: SelectChangeEvent) => {
      setSelectedTeachers((prevSelectedTeachers) => ({
        ...prevSelectedTeachers,
        [templateId]: event.target.value,
      }));
    },
    []
  );

  const createTemplateData = useCallback(
    async (id: number, discipline: string) => {
      const teacher = selectedTeachers[id];
      if (!teacher) {
        showWarningMessage("Необходимо выбрать преподавателя");
        return;
      }

      try {
        const params: CreateTemplateDataParams = {
          id_1c: id,
          complectId,
          teacher,
          year: selectedTemplateData.year,
          discipline,
          userName,
        };

        const response = await axiosBase.post("create-profile-template-from-1c", params);

        if (response.data === "record exists") showErrorMessage("Ошибка. Шаблон с текущими данными уже существует");
        if (response.data === "template created") {
          showSuccessMessage("Шаблон успешно создан");
          fetchComplectData();
        }
      } catch (error) {
        showErrorMessage("Ошибка. Не удалось создать шаблон");
        console.error(error);
      }
    },
    [selectedTeachers, complectId, selectedTemplateData.year, userName, fetchComplectData]
  );

  const filteredData = useMemo(() => handleFilteredData(), [handleFilteredData]);

  const columns = useMemo<MRT_ColumnDef<TemplateData>[]>(
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
        Cell: ({ row }: { row: { original: TemplateData } }) => (
          <Box width={"100%"}>
            <FormControl fullWidth variant="standard">
              {row.original.teacher ? (
                <Select
                  labelId={`select-label-${row.original.id}`}
                  id={`select-${row.original.id}`}
                  value={row.original.teacher}
                  label="Преподаватель"
                  disabled
                  fullWidth
                >
                  <MenuItem key={row.original.teacher} value={row.original.teacher}>
                    {row.original.teacher}
                  </MenuItem>
                </Select>
              ) : (
                <Select
                  labelId={`select-label-${row.original.id}`}
                  id={`select-${row.original.id}`}
                  value={selectedTeachers[row.original.id] || ""}
                  label="Преподаватель"
                  onChange={handleChange(row.original.id)}
                  fullWidth
                >
                  {row.original.teachers.map((name: string) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </FormControl>
          </Box>
        ),
      },
      {
        accessorKey: "status",
        header: "Статус",
        Cell: ({ row }: { row: { original: TemplateData } }) => {
          return (
            <Box>
              <TemplateStatus status={row.original.status} />
            </Box>
          );
        },
      },
      {
        accessorKey: "choise",
        header: "Действие",
        size: 100,
        Cell: ({ row }: { row: { original: TemplateData } }) => (
          <Box>
            {row.original.status.status === TemplateStatusEnum.UNLOADED ? (
              <Button variant="contained" onClick={() => createTemplateData(row.original.id, row.original.discipline)}>
                Создать
              </Button>
            ) : (
              <TemplateMenu
                id={row.original.id_profile_template}
                teacher={row.original.teacher}
                status={row.original.status.status}
                fetchData={fetchComplectData}
              />
            )}
          </Box>
        ),
      },
    ],
    [selectedTeachers, handleChange, createTemplateData, fetchComplectData]
  );

  const table = useMaterialReactTable<TemplateData>({
    columns,
    data: filteredData,
    localization: MRT_Localization_RU,
    enableRowSelection: true,
    enableColumnResizing: true,
    layoutMode: "grid",
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
    renderToolbarAlertBannerContent: ({ table }) => (
      <Box
        sx={{
          display: "flex",
          px: 2,
          gap: "8px",
        }}
      >
        <Button onClick={() => table.resetRowSelection()}>Очистить выбор</Button>
      </Box>
    ),
  });

  if (!complectMeta) return <Loader />;

  return (
    <Box>
      <PageTitle title={`${complectMeta.profile} ${complectMeta.year}`} backNavPath={RedirectPath.COMPLECTS} />
      <Box pt={2}>
        <MaterialReactTable table={table} />
      </Box>
    </Box>
  );
}
