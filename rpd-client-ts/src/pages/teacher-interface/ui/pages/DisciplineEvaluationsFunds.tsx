import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";
import { PageTitleComment } from "@shared/ui";

const DisciplineEvaluationsFunds: FC = () => {
  return (
    <Box>
      <PageTitleComment
        title="Фонды оценочных средств по дисциплине"
        paddingBottom={2}
        templateField={TemplatePagesPath.DISCIPLINE_EVALUATIONS_FUNDS}
      />
      <JsonChangeValue elementName="assessment_tools_template" />
    </Box>
  );
};

export default DisciplineEvaluationsFunds;
