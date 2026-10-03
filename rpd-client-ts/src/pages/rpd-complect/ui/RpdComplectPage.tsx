import { useTemplateHistory } from "@entities/template";
import HistoryModal from "./HistoryModal";
import { Loader, PageTitle } from "@shared/ui";
import { Box } from "@mui/material";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RedirectPath } from "@shared/enums";
import { ComplectTableHeader } from "@widgets/table-header";
import { useComplectData, useComplectTableColumns } from "../hooks";
import { complectTableOptions } from "../config";
import type { TemplateData } from "../types";
import { BuildFundsByComplectDialog } from "./BuildFundsByComplectDialog";
import { AssignTeachersDialog } from "@features/assign-teachers";

export function RpdComplectPage() {
  const { id: complectId } = useParams();
  const navigate = useNavigate();
  const [historyTemplateId, setHistoryTemplateId] = useState<number | null>(
    null
  );
  const history = useTemplateHistory(historyTemplateId);
  const [openBuildFunds, setOpenBuildFunds] = useState(false);
  const [teachersExchangeId, setTeachersExchangeId] = useState<number | null>(
    null
  );
  const {
    complectMeta,
    selectedTeacherIds,
    setSelectedTeacherIds,
    filteredData,
    fetchComplectData,
    createTemplateData,
  } = useComplectData(complectId);
  const columns = useComplectTableColumns({
    selectedTeacherIds,
    onCreateTemplate: createTemplateData,
    onFetchData: fetchComplectData,
    onOpenTeachers: setTeachersExchangeId,
    onOpenHistory: setHistoryTemplateId,
  });
  const teachersRow = filteredData.find((row) => row.id === teachersExchangeId);
  const table = useMaterialReactTable<TemplateData>({
    ...complectTableOptions,
    columns,
    data: filteredData,
    getRowId: (row) => String(row.id),
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
      <Box sx={{ pt: 2 }}>
        <MaterialReactTable table={table} />
      </Box>
      {complectId ? (
        <BuildFundsByComplectDialog
          open={openBuildFunds}
          complectId={complectId}
          onClose={() => setOpenBuildFunds(false)}
        />
      ) : null}
      <HistoryModal
        history={history.data ?? []}
        openDialog={historyTemplateId != null}
        isPending={history.isPending}
        isError={history.isError}
        setOpenDialog={(open) => {
          if (!open) setHistoryTemplateId(null);
        }}
      />
      {teachersRow ? (
        <AssignTeachersDialog
          key={teachersRow.id}
          discipline={teachersRow.discipline}
          templateId={teachersRow.id_profile_template}
          status={teachersRow.status}
          participants={teachersRow.participants}
          hints={teachersRow.teacherHints}
          canEditTeachers={teachersRow.canEditTeachers}
          selectedIds={selectedTeacherIds[teachersRow.id] ?? []}
          onSelectedIdsChange={(ids) =>
            setSelectedTeacherIds((previous) => ({
              ...previous,
              [teachersRow.id]: ids,
            }))
          }
          onRefresh={fetchComplectData}
          onClose={() => setTeachersExchangeId(null)}
        />
      ) : null}
    </Box>
  );
}
