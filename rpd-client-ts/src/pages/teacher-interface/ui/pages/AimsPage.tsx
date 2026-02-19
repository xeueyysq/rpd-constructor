import { Box } from "@mui/material";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";
import { PageTitleComment } from "@shared/ui";
import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";

const AimsPage: FC = () => {
  return (
    <Box>
      <PageTitleComment
        title="Цели и задачи освоения дисциплины"
        paddingBottom={2}
        templateField={TemplatePagesPath.AIMS_PAGE}
      />
      <JsonChangeValue elementName="goals" />
    </Box>
  );
};

export default AimsPage;
