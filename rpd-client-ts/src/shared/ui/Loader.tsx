import { Box, CircularProgress } from "@mui/material";

export function Loader() {
  return (
    <Box sx={{ p: 1, gap: 1, display: "flex" }}>
      <CircularProgress color="inherit" size="1.5rem" />
      <Box fontFamily={"Arial"} sx={{ px: 1, pb: 1 }}>
        Загрузка...
      </Box>
    </Box>
  );
}
