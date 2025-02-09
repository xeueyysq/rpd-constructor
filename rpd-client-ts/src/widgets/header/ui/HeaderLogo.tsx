import { Box, Typography } from "@mui/material";
import { FC } from "react";

const HeaderLogo: FC = () => {
  return (
    <Box sx={{ px: 1 }} alignItems={"center"} alignContent={"center"}>
      <Typography
        variant="overline"
        display="block"
        sx={{
          color: "black",
          fontWeight: "600",
          fontSize: "14px",
          userSelect: "none",
        }}
      >
        Конструктор РПД
      </Typography>
    </Box>
  );
};

export default HeaderLogo;
