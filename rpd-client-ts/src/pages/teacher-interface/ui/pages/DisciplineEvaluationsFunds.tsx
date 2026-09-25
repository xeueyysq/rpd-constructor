import { Box } from "@mui/material";
import { TemplatePagesPath } from "@shared/enums";
import { PageTitleComment } from "../PageTitleComment";
import { FC } from "react";
import { DisciplineEvaluationsFundsForm } from "@features/discipline-evaluations-funds";

const DisciplineEvaluationsFunds: FC = () => {
  return (
    <Box>
      <PageTitleComment
        title="Фонды оценочных средств по дисциплине"
        sx={{ pb: 2 }}
        templateField={TemplatePagesPath.DISCIPLINE_EVALUATIONS_FUNDS}
      />
      <DisciplineEvaluationsFundsForm />
    </Box>
  );
};

export default DisciplineEvaluationsFunds;
