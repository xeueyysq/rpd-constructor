import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { PageTitle } from "@shared/ui";
import { CommentChangeValue } from "../changeable-elements/CommentChangeValue.tsx";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";

const DisciplineEvaluationsFunds: FC = () => {
  return (
    <Box>
      <PageTitle title="Фонды оценочных средств по дисциплине" paddingBottom={2} />
      <CommentChangeValue templateField={TemplatePagesPath.DISCIPLINE_EVALUATIONS_FUNDS} />
      <JsonChangeValue elementName="assessment_tools_template" />
    </Box>
  );
};

export default DisciplineEvaluationsFunds;
