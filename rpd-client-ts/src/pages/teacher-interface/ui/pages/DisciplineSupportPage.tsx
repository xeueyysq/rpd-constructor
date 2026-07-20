import { Box } from "@mui/material";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";
import { PageTitleComment } from "@shared/ui";
import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";

const DisciplineSupportPage: FC = () => {
  return (
    <Box>
      <PageTitleComment
        title="Перечень учебно-методического обеспечения по дисциплине"
        paddingBottom={2}
        templateField={TemplatePagesPath.DISCIPLINE_SUPPORT}
      />
      <JsonChangeValue elementName="methodological_support_template" />
    </Box>
  );
};

export default DisciplineSupportPage;
