import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { PageTitle } from "@shared/ui";

const DisciplineEvaluationsFunds: FC = () => {
  return (
    <Box>
      <PageTitle title="Фонды оценочных средств по дисциплине" />
      <JsonChangeValue elementName="assessment_tools_template" />
    </Box>
  );
};

export default DisciplineEvaluationsFunds;
