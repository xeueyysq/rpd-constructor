import { Loader, PageTitle } from "@shared/ui";
import { Box } from "@mui/material";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RedirectPath } from "@shared/enums";
import { ComplectTableHeader } from "@widgets/table-header/ui/ComplectTableHeader";
import { useComplectData, useComplectTableColumns } from "../hooks";
import { complectTableOptions } from "../config";
import type { TemplateData } from "../types";
import { BuildFundsByComplectDialog } from "./BuildFundsByComplectDialog";

export function RpdComplectPage() {
  const { id: complectId } = useParams();
  const navigate = useNavigate();
  const [openBuildFunds, setOpenBuildFunds] = useState(false);

  const {
    complectMeta,
    selectedTeachers,
    filteredData,
    fetchComplectData,
    handleTeachersChange,
    createTemplateData,
  } = useComplectData(complectId);

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
    renderTopToolbarCustomActions: () => (
      <ComplectTableHeader
        id={complectId}
        onAfterDelete={() => navigate(RedirectPath.COMPLECTS)}
        onBuildFundsClick={() => setOpenBuildFunds(true)}
        onSyncApplied={fetchComplectData}
      />
    ),
  });

  if (!complectMeta) return <Loader />;

  return (
    <Box>
      <PageTitle
        title={`${complectMeta.profile} ${complectMeta.year}`}
        backNavPath={RedirectPath.COMPLECTS}
      />
      <Box pt={2}>
        <MaterialReactTable table={table} />
      </Box>
      {complectId ? (
        <BuildFundsByComplectDialog
          open={openBuildFunds}
          complectId={complectId}
          onClose={() => setOpenBuildFunds(false)}
        />
      ) : null}
    </Box>
  );
}
