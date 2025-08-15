import { Box, Button } from "@mui/material";
import { FC } from "react";
import { useNavigate } from "react-router-dom";

const HeaderLogo: FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ px: 1 }} alignItems={"center"} alignContent={"center"}>
      <Button
        // type="overline"
        // display="block"
        onClick={() => navigate("/complects")}
        sx={{
          color: "white",
          fontWeight: "600",
          fontSize: "16px",
          userSelect: "none",
        }}
      >
        Конструктор РПД
      </Button>
    </Box>
  );
};

export default HeaderLogo;
