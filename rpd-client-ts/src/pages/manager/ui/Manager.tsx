import { ChangeRpdTemplate } from "@features/change-rpd-template";
import { TemplateConstructor } from "@features/create-rpd-template";
import { CreateRpdTemplateFromYear } from "@features/create-rpd-template-from-year";
import { Selectors } from "@features/select-template-data";
import { Box } from "@mui/material";
import RpdComplectPage from "@pages/rpd-complect";
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
        {managerPage === "createTemplateFromExchange" && <RpdComplectPage />}
      </Box>
    </Box>
  );
};
