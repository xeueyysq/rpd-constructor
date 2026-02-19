import { Box, Dialog } from "@mui/material";

interface IBookThumbZoom {
  thumb: string | undefined;
  zoomOut: (value: undefined) => void;
}

export function BookThumbZoom({ thumb, zoomOut }: IBookThumbZoom) {
  return (
    <Dialog open={!!thumb} onClose={zoomOut}>
      <Box component="img" src={thumb} sx={{ width: "300px" }}></Box>
    </Dialog>
  );
}
