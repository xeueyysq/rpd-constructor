import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Container } from "@mui/material";
import { RpdComplectPage } from "@pages/rpd-complect/ui/RpdComplectPage";
import { RedirectPath } from "@shared/enums";
import { FC } from "react";
import { useNavigate } from "react-router-dom";

export const ViewRpdComplect: FC = () => {
  const navigate = useNavigate();

  return (
    <Container
      maxWidth="xl"
      sx={{
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Box
        sx={{ my: 4, p: 2, ml: 2, backgroundColor: "#fefefe", width: "100%" }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <Button
            variant="outlined"
            onClick={() => navigate(RedirectPath.COMPLECTS)}
            startIcon={<ArrowBackIcon />}
            sx={{ mr: 2 }}
          >
            Назад к списку
          </Button>
          <Box sx={{ fontSize: "1.5rem", m: 0 }}>Просмотр комплекта РПД</Box>
        </Box>
        <RpdComplectPage />
      </Box>
    </Container>
  );
};
