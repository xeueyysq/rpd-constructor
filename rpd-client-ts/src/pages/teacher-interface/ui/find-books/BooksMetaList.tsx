import {
  MaterialReactTable,
  MRT_ColumnDef,
  useMaterialReactTable,
} from "material-react-table";
import { useMemo, useState } from "react";
import { Box, Button } from "@mui/material";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import AddIcon from "@mui/icons-material/Add";
import { BookThumbZoom } from "./BookThumbZoom";
import type { Book } from "../../api/findBooks";

interface IBooksMetaList {
  books: Book[];
  addBooksToList: (biblios: string[]) => void;
  closeDialog: () => void;
}

export function BooksMetaList({
  books,
  addBooksToList,
  closeDialog,
}: IBooksMetaList) {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [zoomThumbSrc, setZoomThumbSrc] = useState<string | undefined>(
    undefined
  );

  const handleAddBooks = () => {
    const selectedBooks = books
      .filter((book) => rowSelection[book.id])
      .map((book) => book.biblio);
    addBooksToList(selectedBooks);
    closeDialog();
  };

  const columns = useMemo<MRT_ColumnDef<Book>[]>(
    () => [
      {
        accessorKey: "thumb",
        header: "Обложка",
        Cell: ({ row }) =>
          row.original.thumb && (
            <Box
              onClick={() => setZoomThumbSrc(row.original.thumb ?? undefined)}
              sx={{ p: 2, width: "100px", cursor: "pointer" }}
              component="img"
              src={row.original.thumb}
            />
          ),
        enableColumnFilter: false,
        enableSorting: false,
        size: 50,
      },
      {
        accessorKey: "title",
        header: "Название",
        size: 70,
      },
      {
        accessorKey: "author",
        header: "Автор(-ы)",
        size: 70,
      },
      {
        accessorKey: "year",
        header: "Год",
        size: 0,
      },
      {
        accessorKey: "biblio",
        header: "Аннотация",
      },
      {
        accessorKey: "url",
        header: "",
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) =>
          row.original.url && (
            <Button
              size="medium"
              sx={{ textDecoration: "underline" }}
              component="a"
              href={row.original.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Источник
            </Button>
          ),
        size: 0,
      },
    ],
    []
  );

  const table = useMaterialReactTable<Book>({
    columns,
    data: books,
    getRowId: (book) => book.id,
    localization: MRT_Localization_RU,
    layoutMode: "grid",
    enableRowSelection: true,
    positionToolbarAlertBanner: "none",
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    muiTableProps: {
      size: "small",
      className: "table",
    },
    muiTableBodyCellProps: {
      sx: {
        py: 0.5,
      },
    },
    initialState: { pagination: { pageSize: 20, pageIndex: 0 } },
    renderTopToolbarCustomActions: ({ table }) => {
      const selectedRowsCount = Object.values(
        table.getState().rowSelection
      ).filter(Boolean).length;
      return (
        <Box
          sx={{
            display: "flex",
            px: 1.5,
            pt: 0.5,
            gap: "12px",
          }}
        >
          <Button
            variant="outlined"
            disabled={!selectedRowsCount}
            startIcon={<AddIcon />}
            sx={{ alignSelf: "flex-start" }}
            onClick={handleAddBooks}
          >
            Добавить в список
          </Button>
        </Box>
      );
    },
  });

  return (
    <Box sx={{ pt: 2 }}>
      <MaterialReactTable table={table} />
      <BookThumbZoom
        thumb={zoomThumbSrc}
        zoomOut={() => setZoomThumbSrc(undefined)}
      />
    </Box>
  );
}
