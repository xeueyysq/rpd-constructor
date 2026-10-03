import { useTheme } from "@mui/material";
import type { MRT_ColumnDef, MRT_RowData } from "material-react-table";
import { useMemo } from "react";

type ActionsColumnOptions<TData extends MRT_RowData> = Pick<
  MRT_ColumnDef<TData>,
  | "size"
  | "minSize"
  | "maxSize"
  | "grow"
  | "enableResizing"
  | "enableColumnActions"
  | "enableSorting"
  | "enableColumnFilter"
>;

// Колонка «Действия» по ширине содержимого: заголовок и кнопка «…», без ⋮ и ресайза.
export function useActionsColumn<
  TData extends MRT_RowData,
>(): ActionsColumnOptions<TData> {
  const theme = useTheme();
  return useMemo(() => {
    const width = Number.parseFloat(theme.spacing(14));
    return {
      size: width,
      minSize: width,
      maxSize: width,
      grow: false,
      enableResizing: false,
      enableColumnActions: false,
      enableSorting: false,
      enableColumnFilter: false,
    };
  }, [theme]);
}
