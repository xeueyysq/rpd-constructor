import { statusConfig } from "@entities/template/model/templateStatusCodes";
import { TableCell } from "@mui/material";

export function StatusCell({ status }: { status: keyof typeof statusConfig }) {
  const cfg = statusConfig[status];
  const Icon = cfg?.icon;

  return (
    <TableCell sx={{ maxWidth: "45px" }}>
      {Icon && <Icon color={cfg.color as any} />}
    </TableCell>
  );
}
