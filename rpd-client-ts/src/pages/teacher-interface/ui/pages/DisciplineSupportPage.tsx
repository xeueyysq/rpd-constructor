import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { PageTitle } from "@shared/ui";
import { CommentChangeValue } from "../changeable-elements/CommentChangeValue.tsx";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";

const DisciplineSupportPage: FC = () => {
  return (
    <Box>
      <PageTitle title="Перечень учебно-методического обеспечения по дисциплине" paddingBottom={2} />
      <CommentChangeValue templateField={TemplatePagesPath.DISCIPLINE_SUPPORT} />
      <JsonChangeValue elementName="methodological_support_template" />
    </Box>
  );
};

export default DisciplineSupportPage;
