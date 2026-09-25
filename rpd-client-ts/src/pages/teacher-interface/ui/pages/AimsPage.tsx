import { Box } from "@mui/material";
import { TemplatePagesPath } from "@shared/enums";
import { PageTitleComment } from "../PageTitleComment";
import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";

const AimsPage: FC = () => {
  return (
    <Box>
      <PageTitleComment
        title="Цели и задачи освоения дисциплины"
        sx={{ pb: 2 }}
        templateField={TemplatePagesPath.AIMS_PAGE}
      />
      <JsonChangeValue elementName="goals" />
    </Box>
  );
};

export default AimsPage;
