import { TemplateConstructor } from "@features/create-rpd-template";
import { Selectors } from "@features/select-template-data";
import { Box } from "@mui/material";
import { useStore } from "@shared/hooks";
import { PageTitle } from "@shared/ui";
import type { ReactNode } from "react";

export function Manager({ complectPage }: { complectPage: ReactNode }) {
  const { managerPage, setManagerPage } = useStore();
  return (
    <Box>
      <Box
        sx={{
          p: 3,
          backgroundColor: "background.paper",
          width: "100%",
          minHeight: "85vh",
        }}
      >
        <PageTitle title="Создание комплекта РПД на основе учебного плана" />
        {managerPage === "selectData" ? (
          <Selectors setChoise={setManagerPage} />
        ) : null}
        {managerPage === "workingType" ? (
          <TemplateConstructor setChoise={setManagerPage} />
        ) : null}
        {managerPage === "createTemplateFromExchange" ? complectPage : null}
      </Box>
    </Box>
  );
}
