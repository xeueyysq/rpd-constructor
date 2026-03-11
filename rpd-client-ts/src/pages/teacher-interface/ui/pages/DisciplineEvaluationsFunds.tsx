import { Box } from "@mui/material";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";
import { PageTitleComment } from "@shared/ui/PageTitleComment.tsx";
import { FC } from "react";
import DisciplineEvaluationsFundsForm from "@features/discipline-evaluations-funds/ui/DisciplineEvaluationsFundsForm";

const DisciplineEvaluationsFunds: FC = () => {
  return (
    <Box>
      <PageTitleComment
        title="Фонды оценочных средств по дисциплине"
        paddingBottom={2}
        templateField={TemplatePagesPath.DISCIPLINE_EVALUATIONS_FUNDS}
      />
      <DisciplineEvaluationsFundsForm />
    </Box>
  );
};

export default DisciplineEvaluationsFunds;
