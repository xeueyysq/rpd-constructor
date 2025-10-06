import { FC } from "react";
import { Box, Button, Container } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { CreateRpdTemplateFrom1CExchange } from "@features/create-rpd-template-from-1c-exchange";

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
        my={4}
        p={2}
        ml={2}
        sx={{
          backgroundColor: "#fefefe",
          width: "100%",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <Button
            variant="outlined"
            onClick={() => navigate("/rpd-complects")}
            startIcon={<ArrowBackIcon />}
            sx={{ mr: 2 }}
          >
            Назад к списку
          </Button>
          <Box fontSize={"1.5rem"} sx={{ m: 0 }}>
            Просмотр комплекта РПД
          </Box>
        </Box>

        <CreateRpdTemplateFrom1CExchange setChoise={() => navigate("/rpd-complects")} />
      </Box>
    </Container>
  );
};
