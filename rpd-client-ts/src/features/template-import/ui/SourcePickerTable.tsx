import { useMemo, type ReactNode } from "react";
import { Box, IconButton, Radio, Tooltip, Typography } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { lighten } from "@mui/material/styles";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  MaterialReactTable,
  MRT_TablePagination,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { sourceLabel, recordTypeLabel } from "../lib/sourceLabel";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import {
  getTemplateStatusLabel,
  type ImportCatalogSummary,
  type ImportCatalogTemplate,
} from "@entities/template";

type Source = ImportCatalogSummary | ImportCatalogTemplate;

function complect(row: Source) {
  return "complect" in row ? row.complect : row;
}

export function SourcePickerTable({
  rows,
  bulk,
  field,
  busy,
  total,
  page,
  pageSize,
  toolbar,
  emptyState,
  showPagination,
  selectedId,
  previewId,
  previewRegionId,
  preview,
  onSelect,
  onPreview,
  onPage,
}: {
  rows: Source[];
  bulk: boolean;
  field: boolean;
  busy: boolean;
  total: number;
  page: number;
  pageSize: number;
  toolbar: ReactNode;
  emptyState: ReactNode;
  showPagination: boolean;
  selectedId: number | null;
  previewId: number | null;
  previewRegionId: string;
  preview: ReactNode;
  onSelect: (id: number) => void;
  onPreview: (id: number | null) => void;
  onPage: (page: number) => void;
}) {
  const narrow = useMediaQuery((theme) => theme.breakpoints.down("sm"));
  const columns = useMemo<MRT_ColumnDef<Source>[]>(
    () => [
      {
        id: "name",
        header: bulk ? "Программа / профиль" : "Дисциплина",
        size: bulk ? 470 : 260,
        Cell: ({ row: { original: row } }) => {
          const source = complect(row);
          return (
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                {"complect" in row
                  ? (row.disciplins_name ?? "—")
                  : (source.profile ?? "Комплект №" + row.id)}
              </Typography>
              {bulk && (
                <Typography
                  component="div"
                  variant="caption"
                  sx={{ color: "text.secondary" }}
                >
                  {source.direction}
                  <br />
                  {source.faculty}
                </Typography>
              )}
              {narrow && (
                <Typography
                  component="div"
                  variant="caption"
                  sx={{ color: "text.secondary", mt: 0.25 }}
                >
                  {"complect" in row ? (
                    <>
                      {row.semester ?? "—"} семестр ·{" "}
                      {recordTypeLabel(row.record_type)} ·{" "}
                      {getTemplateStatusLabel(row.status)}
                      <br />
                      {source.profile}
                      <br />
                      {source.direction}
                      <br />
                      {source.faculty}
                      <br />
                    </>
                  ) : null}
                  {source.year ?? "—"} · {source.education_form ?? "—"}
                  {bulk ? (
                    <>
                      <br />
                      РОП:{" "}
                      {source.owners
                        .map((owner) => owner.fullname)
                        .join(", ") || "Не назначены"}
                    </>
                  ) : null}
                </Typography>
              )}
            </Box>
          );
        },
      },
      {
        id: "period",
        header: bulk ? "Набор / форма" : "Семестр / статус",
        size: 152,
        Cell: ({ row: { original: row } }) => (
          <Box>
            {"complect" in row ? (
              <>
                {row.semester ?? "—"} семестр
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ color: "text.secondary" }}
                >
                  {recordTypeLabel(row.record_type)}
                  <br />
                  {getTemplateStatusLabel(row.status)}
                </Typography>
              </>
            ) : (
              <>
                {row.year ?? "—"}
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ color: "text.secondary" }}
                >
                  {row.education_form ?? "—"}
                </Typography>
              </>
            )}
          </Box>
        ),
      },
      {
        id: "source",
        header: bulk ? "Назначенные РОП" : "Программа-источник",
        size: bulk ? 280 : 480,
        Cell: ({ row: { original: row } }) => {
          const source = complect(row);
          return "complect" in row ? (
            <Box>
              <Typography>{source.profile}</Typography>
              <Typography
                component="div"
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                {source.direction}
                <br />
                {source.year ?? "—"} · {source.education_form ?? "—"} ·{" "}
                {source.faculty}
              </Typography>
            </Box>
          ) : (
            <Typography>
              {source.owners.map((owner) => owner.fullname).join(", ") ||
                "Не назначены"}
            </Typography>
          );
        },
      },
    ],
    [bulk, narrow]
  );
  const table = useMaterialReactTable({
    columns,
    data: rows,
    localization: {
      ...MRT_Localization_RU,
      goToPreviousPage: "Предыдущая страница",
      goToNextPage: "Следующая страница",
    },
    getRowId: (row) => String(row.id),
    layoutMode: "semantic",
    mrtTheme: (theme) => ({
      baseBackgroundColor: theme.palette.background.paper,
      selectedRowBackgroundColor: lighten(theme.palette.info.main, 0.94),
    }),
    manualPagination: true,
    rowCount: total,
    enableRowSelection: !busy,
    enableMultiRowSelection: false,
    enableSelectAll: false,
    enableSorting: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableGlobalFilter: false,
    enableKeyboardShortcuts: false,
    enableToolbarInternalActions: false,
    enableTopToolbar: true,
    enableBottomToolbar: showPagination,
    enableStickyHeader: true,
    enableExpandAll: false,
    enableExpanding: field,
    state: {
      pagination: { pageIndex: page - 1, pageSize },
      rowSelection: selectedId == null ? {} : { [selectedId]: true },
      expanded: previewId == null ? {} : { [previewId]: true },
      density: "compact",
      columnVisibility: { period: !narrow, source: !narrow },
    },
    onPaginationChange: (updater) => {
      if (busy) return;
      const current = { pageIndex: page - 1, pageSize };
      onPage(
        (typeof updater === "function" ? updater(current) : updater).pageIndex +
          1
      );
    },
    renderTopToolbar: () => toolbar,
    renderBottomToolbar: ({ table }) => (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          px: 2,
          gap: 1,
          borderTop: 1,
          borderColor: "divider",
          "& .MuiTablePagination-root": { py: 0.5, px: 0, gap: 0.5 },
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Найдено: {total}
        </Typography>
        <MRT_TablePagination table={table} />
      </Box>
    ),
    muiPaginationProps: {
      disabled: busy,
      showRowsPerPage: false,
      rowsPerPageOptions: [pageSize],
      showFirstButton: false,
      showLastButton: false,
    },
    renderEmptyRowsFallback: () => emptyState,
    positionExpandColumn: "last",
    displayColumnDefOptions: {
      "mrt-row-select": {
        header: "",
        size: narrow ? 36 : 44,
        minSize: 36,
        maxSize: 44,
        muiTableBodyCellProps: { sx: { px: 0.25 } },
        muiTableHeadCellProps: { sx: { px: 0.25 } },
        Cell: ({ row }) => (
          <Radio
            name={previewRegionId + "-source"}
            checked={row.getIsSelected()}
            disabled={busy}
            slotProps={{ input: { "aria-label": sourceLabel(row.original) } }}
            onChange={() => onSelect(row.original.id)}
            onClick={(event) => event.stopPropagation()}
            sx={{ p: 0.5 }}
          />
        ),
      },
      "mrt-row-expand": {
        header: "",
        size: 40,
        minSize: 40,
        maxSize: 40,
        muiTableBodyCellProps: { sx: { px: 0.25 } },
        muiTableHeadCellProps: { sx: { px: 0.25 } },
        Cell: ({ row }) => (
          <Tooltip
            title={
              row.getIsExpanded() ? "Скрыть содержимое" : "Просмотр раздела"
            }
          >
            <IconButton
              aria-label={"Просмотр: " + sourceLabel(row.original)}
              aria-expanded={row.getIsExpanded()}
              aria-controls={row.getIsExpanded() ? previewRegionId : undefined}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onPreview(row.getIsExpanded() ? null : row.original.id);
              }}
            >
              <VisibilityOutlinedIcon
                sx={{
                  color: row.getIsExpanded()
                    ? "primary.main"
                    : "text.secondary",
                }}
              />
            </IconButton>
          </Tooltip>
        ),
      },
    },
    muiTableProps: {
      "aria-label": bulk ? "Комплекты источников" : "Дисциплины источников",
      sx: { width: "100%", tableLayout: "fixed", minWidth: 0 },
    },
    muiTablePaperProps: {
      elevation: 0,
      sx: {
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: 0,
      },
    },
    muiTableContainerProps: {
      sx: {
        flex: 1,
        minHeight: 0,
        maxHeight: "none",
        width: "100%",
        minWidth: 0,
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
      },
    },
    muiTableHeadCellProps: ({ column }) => ({
      sx: {
        py: 1,
        minWidth: 0,
        width:
          column.id === "name"
            ? narrow
              ? "auto"
              : bulk
                ? "48%"
                : "28%"
            : column.id === "period"
              ? "16%"
              : column.id === "source"
                ? "auto"
                : undefined,
        whiteSpace: "normal",
        "& .Mui-TableHeadCell-Content-Wrapper": { whiteSpace: "normal" },
      },
    }),
    muiTableBodyCellProps: {
      sx: {
        minWidth: 0,
        whiteSpace: "normal",
        verticalAlign: "middle",
        py: 0.75,
        bgcolor: "background.paper",
      },
    },
    muiTableBodyRowProps: ({ row }) => ({
      tabIndex: busy ? -1 : 0,
      "aria-selected": row.getIsSelected(),
      "aria-disabled": busy,
      onClick: (event) => {
        if (
          busy ||
          (event.target instanceof Element &&
            event.target.closest(
              'button, a, input, select, textarea, [role="button"], [contenteditable="true"]'
            ))
        )
          return;
        onSelect(row.original.id);
      },
      onKeyDown: (event) => {
        if (
          busy ||
          event.target !== event.currentTarget ||
          (event.key !== "Enter" && event.key !== " ")
        )
          return;
        event.preventDefault();
        onSelect(row.original.id);
      },
      sx: (theme) => ({
        cursor: busy ? "default" : "pointer",
        // MRT рисует selection и hover также псевдоэлементом каждой ячейки.
        "& > td:after, &:hover > td:after": {
          backgroundColor: row.getIsSelected()
            ? lighten(theme.palette.info.main, 0.94)
            : theme.palette.action.hover,
        },
        "&:not(:hover):not(.Mui-selected) > td:after": {
          backgroundColor: "transparent",
        },
      }),
    }),
    muiDetailPanelProps: {
      sx: {
        p: "0 !important",
        maxWidth: "100%",
        minWidth: 0,
        bgcolor: "background.paper",
      },
    },
    renderDetailPanel: field
      ? ({ row }) => (row.getIsExpanded() ? preview : null)
      : undefined,
  });
  return <MaterialReactTable table={table} />;
}
