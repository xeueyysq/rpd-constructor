import { Box } from "@mui/material";
import { TemplatePagesPath } from "@shared/enums";
import { PageTitleComment } from "../PageTitleComment";
import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";

const DisciplineSupportPage: FC = () => {
  return (
    <Box>
      <PageTitleComment
        title="Перечень учебно-методического обеспечения по дисциплине"
        sx={{ pb: 2 }}
        templateField={TemplatePagesPath.DISCIPLINE_SUPPORT}
      />
      <JsonChangeValue elementName="methodological_support_template" />
    </Box>
  );
};

export default DisciplineSupportPage;
