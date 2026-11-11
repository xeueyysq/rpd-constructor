import { TemplateHistoryDialog, useTemplateHistory } from "@entities/template";
import { Loader, PageTitle } from "@shared/ui";
import { Alert, Box } from "@mui/material";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RedirectPath } from "@shared/enums";
import { ComplectTableHeader } from "@widgets/table-header";
import { useComplectData, useComplectTableColumns } from "../hooks";
import { complectTableOptions } from "../config";
import type { TemplateData } from "../types";
import { BuildFundsByComplectDialog } from "./BuildFundsByComplectDialog";
import { AssignTeachersDialog } from "@features/assign-teachers";
import { ImportFromComplectsDialog } from "./ImportFromComplectsDialog";
import { useAuth } from "@entities/auth";
import { useRpdComplectsQuery } from "@entities/rpd-complect";
import { UserRole } from "@shared/ability";

export function RpdComplectPage() {
  const { id: complectId } = useParams();
  const navigate = useNavigate();
  const [historyTemplateId, setHistoryTemplateId] = useState<number | null>(
    null
  );
  const history = useTemplateHistory(historyTemplateId);
  const [openBuildFunds, setOpenBuildFunds] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const role = useAuth((state) => state.userRole);
  const { complects: ownedComplects } = useRpdComplectsQuery();
  const [teachersExchangeId, setTeachersExchangeId] = useState<number | null>(
    null
  );
  const {
    complectMeta,
    filteredData,
    fetchComplectData,
    isError,
    isForbidden,
  } = useComplectData(complectId);
  const columns = useComplectTableColumns({
    complect: complectMeta,
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
        onImportClick={
          (role === UserRole.ADMIN || role === UserRole.ROP) &&
          ownedComplects.some((complect) => complect.id === complectMeta?.id)
            ? () => setOpenImport(true)
            : undefined
        }
      />
    ),
  });
  const { columnFilters, globalFilter, sorting } = table.getState();
  useEffect(() => {
    table.setPageIndex(0);
  }, [columnFilters, globalFilter, sorting, complectId, table]);
  if (isError)
    return (
      <Alert severity="error">
        {isForbidden
          ? "Доступ к комплекту запрещён."
          : "Не удалось загрузить комплект."}
      </Alert>
    );
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
      <TemplateHistoryDialog
        history={history.data ?? []}
        open={historyTemplateId != null}
        isPending={history.isPending}
        isError={history.isError}
        onClose={() => setHistoryTemplateId(null)}
      />
      {openImport && complectId && (
        <ImportFromComplectsDialog
          open
          targetComplectId={complectMeta.id}
          targetLabel={`${complectMeta.directionOfStudy} • ${complectMeta.profile} • ${complectMeta.year} • ${complectMeta.formEducation}`}
          onClose={() => setOpenImport(false)}
          onImported={fetchComplectData}
        />
      )}
      {teachersRow?.id_profile_template != null ? (
        <AssignTeachersDialog
          key={teachersRow.id}
          discipline={teachersRow.discipline}
          templateId={teachersRow.id_profile_template}
          status={teachersRow.status}
          participants={teachersRow.participants}
          hints={teachersRow.teacherHints}
          canEditTeachers={teachersRow.canEditTeachers}
          onRefresh={fetchComplectData}
          onClose={() => setTeachersExchangeId(null)}
        />
      ) : null}
    </Box>
  );
}
