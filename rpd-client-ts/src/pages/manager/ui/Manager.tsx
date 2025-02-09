import { FC } from "react";
import { Box, Container } from "@mui/material";
import { Selectors } from "@features/select-template-data";
import { TemplateConstructor } from "@features/create-rpd-template";
import { ChangeRpdTemplate } from "@features/change-rpd-template";
import { CreateRpdTemplateFromYear } from "@features/create-rpd-template-from-year";
import { CreateRpdTemplateFrom1CExchange } from "@features/create-rpd-template-from-1c-exchange";
import { useStore } from "@shared/hooks";

export const Manager: FC = () => {
  const { managerPage, setManagerPage } = useStore();

  return (
    <Container
      maxWidth="xl"
      sx={{
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Box
        sx={{
          backgroundColor: "#fefefe",
          width: "100%",
        }}
      >
        <Box component="h2" sx={{ py: 1 }}>
          Создание комплекта РПД на основе учебного плана
        </Box>
        {managerPage === "selectData" && (
          <Selectors setChoise={setManagerPage} />
        )}
        {managerPage === "workingType" && (
          <TemplateConstructor setChoise={setManagerPage} />
        )}
        {managerPage === "changeTemplate" && (
          <ChangeRpdTemplate setChoise={setManagerPage} />
        )}
        {managerPage === "createTemplateFromCurrentYear" && (
          <CreateRpdTemplateFromYear setChoise={setManagerPage} />
        )}
        {managerPage === "createTemplateFromExchange" && (
          <CreateRpdTemplateFrom1CExchange setChoise={setManagerPage} />
        )}
      </Box>
    </Container>
  );
};
