import { ChangeRpdTemplate } from "@features/change-rpd-template";
import { TemplateConstructor } from "@features/create-rpd-template";
import { CreateRpdTemplateFrom1CExchange } from "@features/create-rpd-template-from-1c-exchange";
import { CreateRpdTemplateFromYear } from "@features/create-rpd-template-from-year";
import { Selectors } from "@features/select-template-data";
import { Box } from "@mui/material";
import { useStore } from "@shared/hooks";
import { PageTitle } from "@shared/ui";
import { FC } from "react";

export const Manager: FC = () => {
  const { managerPage, setManagerPage } = useStore();

  return (
    <Box>
      <PageTitle title={"Создание комплекта РПД на основе учебного плана"} />
      <Box
        pl={1}
        sx={{
          backgroundColor: "#fefefe",
          width: "100%",
        }}
      >
        {managerPage === "selectData" && <Selectors setChoise={setManagerPage} />}
        {managerPage === "workingType" && <TemplateConstructor setChoise={setManagerPage} />}
        {managerPage === "changeTemplate" && <ChangeRpdTemplate setChoise={setManagerPage} />}
        {managerPage === "createTemplateFromCurrentYear" && <CreateRpdTemplateFromYear setChoise={setManagerPage} />}
        {managerPage === "createTemplateFromExchange" && <CreateRpdTemplateFrom1CExchange setChoise={setManagerPage} />}
      </Box>
    </Box>
  );
};
