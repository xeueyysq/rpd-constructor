import { Box, Button } from "@mui/material";
import { MRT_Localization_RU } from "material-react-table/locales/ru";
import type { MRT_TableOptions } from "material-react-table";
import type { TemplateData } from "../types";

export const complectTableOptions: Partial<MRT_TableOptions<TemplateData>> = {
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
    sx: { py: 0.5 },
  },
  renderToolbarAlertBannerContent: ({ table }) => (
    <Box sx={{ display: "flex", px: 2, gap: "8px" }}>
      <Button onClick={() => table.resetRowSelection()}>Очистить выбор</Button>
    </Box>
  ),
};
