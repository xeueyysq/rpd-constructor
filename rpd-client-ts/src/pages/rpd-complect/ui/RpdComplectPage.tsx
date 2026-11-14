import { TemplateHistoryDialog, useTemplateHistory } from "@entities/template";
import { Loader, PageTitle } from "@shared/ui";
import { Alert, Box } from "@mui/material";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import { getSessionGeneration } from "@shared/api";
import { setDiagnosticEntity } from "@shared/diagnostics";
import { useStore } from "@shared/hooks";
import { ComplectCompetenciesDialog } from "@features/complect-competencies";
import TemplateMenu from "./TemplateMenu";
import { useComplectContextMenu } from "../hooks/useComplectContextMenu";

export function RpdComplectPage() {
  const { id: complectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const setComplectId = useStore((state) => state.setComplectId);
  const [historyTemplateId, setHistoryTemplateId] = useState<number | null>(
    null
  );
  const history = useTemplateHistory(historyTemplateId);
  const [openBuildFunds, setOpenBuildFunds] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openCompetencies, setOpenCompetencies] = useState(false);
  const contextMenu = useComplectContextMenu();
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
  useEffect(() => {
    if (
      !complectMeta ||
      (complectMeta.uuid !== complectId &&
        String(complectMeta.id) !== complectId)
    )
      return;
    setComplectId(complectMeta.id);
    setDiagnosticEntity(
      {
        complectId: complectMeta.id,
        faculty: complectMeta.faculty ?? undefined,
        direction: complectMeta.directionOfStudy ?? undefined,
        profile: complectMeta.profile ?? undefined,
        form: complectMeta.formEducation ?? undefined,
        year: complectMeta.year == null ? undefined : String(complectMeta.year),
      },
      location.pathname,
      getSessionGeneration()
    );
  }, [complectMeta, complectId, location.pathname, setComplectId]);
  const columns = useComplectTableColumns({
    onOpenTeachers: setTeachersExchangeId,
    onOpenHistory: setHistoryTemplateId,
  });
  const teachersRow = filteredData.find((row) => row.id === teachersExchangeId);
  const menuRow = filteredData.find((row) => row.id === contextMenu.target?.id);
  const table = useMaterialReactTable<TemplateData>({
    ...complectTableOptions,
    columns,
    data: filteredData,
    getRowId: (row) => String(row.id),
    muiTableBodyRowProps: (props) => ({
      ...(typeof complectTableOptions.muiTableBodyRowProps === "function"
        ? complectTableOptions.muiTableBodyRowProps(props)
        : complectTableOptions.muiTableBodyRowProps),
      ...contextMenu.rowProps(props.row.original.id),
    }),
    renderTopToolbarCustomActions: () => (
      <ComplectTableHeader
        id={complectId}
        onAfterDelete={() => navigate(RedirectPath.COMPLECTS)}
        onBuildFundsClick={() => setOpenBuildFunds(true)}
        onSyncApplied={fetchComplectData}
        onCompetenciesClick={
          role === UserRole.ADMIN || role === UserRole.ROP
            ? () => setOpenCompetencies(true)
            : undefined
        }
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
      <ComplectCompetenciesDialog
        complect={
          openCompetencies
            ? {
                id: complectMeta.id,
                label: `${complectMeta.directionOfStudy} • ${complectMeta.profile} • ${complectMeta.year} • ${complectMeta.formEducation}`,
              }
            : null
        }
        onClose={() => setOpenCompetencies(false)}
      />
      {menuRow ? (
        <TemplateMenu
          key={`${complectMeta.id}:${menuRow.id}:${menuRow.id_profile_template}`}
          position={contextMenu.target?.position ?? null}
          onClose={contextMenu.close}
          id={menuRow.id_profile_template}
          status={menuRow.status}
          removedAt={menuRow.removed_at}
          publicId={menuRow.profile_template_public_id}
          allowedActions={menuRow.allowedActions}
          fetchData={fetchComplectData}
          canEditTeachers={menuRow.canEditTeachers}
          targetLabel={`${menuRow.discipline} • семестр ${menuRow.semester} • ${complectMeta.profile} • ${complectMeta.year}`}
          discipline={menuRow.discipline}
          onEditTeachers={() => setTeachersExchangeId(menuRow.id)}
          onOpenHistory={() => {
            if (menuRow.id_profile_template != null)
              setHistoryTemplateId(menuRow.id_profile_template);
          }}
        />
      ) : null}
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
