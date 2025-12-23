import { MaterialReactTable, MRT_ColumnDef, useMaterialReactTable } from "material-react-table";
import { useMemo, useState } from "react";
import { Box, Button } from "@mui/material";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import AddIcon from "@mui/icons-material/Add";
import { BookThumbZoom } from "./BookThumbZoom";

interface BookMeta {
  title: string;
  author: string;
  biblio: string;
  url: string;
  thumb?: string;
  published: string;
}

interface IBooksMetaList {
  books: BookMeta[];
  addBooksToList: (biblios: string[]) => void;
  closeDialog: () => void;
}

export function BooksMetaList({ books, addBooksToList, closeDialog }: IBooksMetaList) {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [zoomThumbSrc, setZoomThumbSrc] = useState<string | undefined>(undefined);

  const handleAddBooks = () => {
    //TODO костыль на поиск выделенных книг
    const selectedBooks = books
      ?.map((book, index) => {
        if (rowSelection[index]) return book.biblio.replace(/<b>.*?<\/b>|<br>/g, "");
      })
      .filter(Boolean);
    addBooksToList(selectedBooks);
    closeDialog();
  };

  const columns = useMemo<MRT_ColumnDef<BookMeta>[]>(
    () => [
      {
        accessorKey: "thumb",
        header: "Обложка",
        Cell: ({ row }) => (
          <Box
            onClick={() => setZoomThumbSrc(row.original.thumb)}
            p={2}
            component="img"
            src={row.original.thumb}
            sx={{ width: "100px", cursor: "pointer" }}
          ></Box>
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
        accessorKey: "published",
        header: "Год",
        Cell: ({ row }) => {
          const published = row.original.published;
          const year = published && isNaN(Number(published)) ? published.split(",")[1] : published;
          return <Box>{year}</Box>;
        },
        size: 0,
      },
      {
        accessorKey: "biblio",
        header: "Аннотация",
        accessorFn: (row) => row.biblio.replace(/<b>.*?<\/b>|<br>/g, ""),
      },
      {
        accessorKey: "url",
        header: "",
        enableColumnFilter: false,
        enableSorting: false,
        Cell: ({ row }) => (
          <Button
            size="medium"
            sx={{ textDecoration: "underline" }}
            component="a"
            href={row.original.url}
            target="_blank"
          >
            Источник
          </Button>
        ),
        size: 0,
      },
    ],
    []
  );

  const table = useMaterialReactTable<BookMeta>({
    columns,
    data: books || [],
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
      const selectedRowsCount = Object.values(table.getState().rowSelection).length;
      //TODO добавить удаление книг из списка
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
    <Box pt={2}>
      <MaterialReactTable table={table} />
      <BookThumbZoom thumb={zoomThumbSrc} zoomOut={() => setZoomThumbSrc(undefined)} />
    </Box>
  );
}
