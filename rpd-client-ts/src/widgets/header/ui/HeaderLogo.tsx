import { Box, Button } from "@mui/material";
import { FC } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@entities/auth";
import { UserRole } from "@shared/ability";

const HeaderLogo: FC = () => {
  const navigate = useNavigate();
  const userRole = useAuth.getState().userRole;

  const handleLogoClick = () => {
    if (userRole === UserRole.ROP) {
      navigate("/complects");
    } else if (userRole === UserRole.TEACHER) {
      navigate("/teacher-interface-templates");
    } else {
      navigate("/complects");
    }
  };

  return (
    <Box sx={{ px: 1 }} alignItems={"center"}>
      <Button
        // type="overline"
        // display="block"
        onClick={handleLogoClick}
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
