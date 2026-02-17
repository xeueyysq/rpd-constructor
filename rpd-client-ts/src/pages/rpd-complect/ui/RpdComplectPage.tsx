import { Loader, PageTitle } from "@shared/ui";
import { Box } from "@mui/material";
import { MaterialReactTable, useMaterialReactTable } from "material-react-table";
import { useParams } from "react-router-dom";
import { RedirectPath } from "@shared/enums";
import { useComplectData, useComplectTableColumns } from "../hooks";
import { complectTableOptions } from "../config";
import type { TemplateData } from "../types";

export function RpdComplectPage() {
  const { id } = useParams();
  const complectId = Number(id);

  const { complectMeta, selectedTeachers, filteredData, fetchComplectData, handleTeachersChange, createTemplateData } =
    useComplectData(complectId);

  const columns = useComplectTableColumns({
    selectedTeachers,
    onTeachersChange: handleTeachersChange,
    onCreateTemplate: createTemplateData,
    onFetchData: fetchComplectData,
  });

  const table = useMaterialReactTable<TemplateData>({
    ...complectTableOptions,
    columns,
    data: filteredData,
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
