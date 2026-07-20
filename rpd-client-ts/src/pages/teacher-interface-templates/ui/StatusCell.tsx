import { statusConfig } from "@entities/template/model/templateStatusCodes";
import { Box, Tooltip } from "@mui/material";

export function StatusCell({ status }: { status: string }) {
  const cfg = statusConfig[status as keyof typeof statusConfig];
  const Icon = cfg?.icon;

  if (!Icon) {
    return <Box sx={{ width: "24px", height: "24px" }} />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "24px",
        height: "24px",
      }}
    >
      <Tooltip title={cfg?.label} arrow>
        <Icon
          color={
            cfg?.color as
              | "primary"
              | "secondary"
              | "success"
              | "error"
              | "warning"
              | "info"
              | undefined
          }
        />
      </Tooltip>
    </Box>
  );
}
