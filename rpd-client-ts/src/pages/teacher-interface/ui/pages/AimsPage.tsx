import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { PageTitle } from "@shared/ui";
import { CommentChangeValue } from "../changeable-elements/CommentChangeValue.tsx";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";

const AimsPage: FC = () => {
  return (
    <Box>
      <PageTitle title="Цели и задачи освоения дисциплины" paddingBottom={2} />
      <CommentChangeValue templateField={TemplatePagesPath.AIMS_PAGE} />
      <JsonChangeValue elementName="goals" />
    </Box>
  );
};

export default AimsPage;
