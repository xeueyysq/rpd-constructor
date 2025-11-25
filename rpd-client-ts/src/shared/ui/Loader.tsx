import { Box } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";

export function Loader() {
  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <CircularProgress />
      {/* <Box fontFamily={"Arial"} sx={{ px: 1, pb: 1 }}>
        Загрузка...
      </Box> */}
    </Box>
  );
}
