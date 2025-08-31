import { Box } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";

export function Loader() {
  return (
    <Box
      sx={{
        position: "absolute",
        top: "50%",
        left: "55%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <CircularProgress />
      {/* <Box fontFamily={"Arial"} sx={{ px: 1, pb: 1 }}>
        Загрузка...
      </Box> */}
    </Box>
  );
}
