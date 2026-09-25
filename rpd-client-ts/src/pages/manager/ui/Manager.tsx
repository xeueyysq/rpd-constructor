import { ChangeRpdTemplate } from "@features/change-rpd-template";
import { TemplateConstructor } from "@features/create-rpd-template";
import { CreateRpdTemplateFromYear } from "@features/create-rpd-template-from-year";
import { Selectors } from "@features/select-template-data";
import { Box } from "@mui/material";
import { useStore } from "@shared/hooks";
import { PageTitle } from "@shared/ui";
import { FC, ReactNode } from "react";

export const Manager: FC<{ complectPage: ReactNode }> = ({ complectPage }) => {
  const { managerPage, setManagerPage } = useStore();

  return (
    <Box>
      <Box
        sx={{
          p: 3,
          backgroundColor: "#ffffff",
          width: "100%",
          minHeight: "85vh",
        }}
      >
        <PageTitle title={"Создание комплекта РПД на основе учебного плана"} />
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
        {managerPage === "createTemplateFromExchange" && complectPage}
      </Box>
    </Box>
  );
};
