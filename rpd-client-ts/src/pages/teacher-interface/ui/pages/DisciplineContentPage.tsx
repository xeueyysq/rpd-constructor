import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { DisciplineContentTable } from "../changeable-elements/DisciplineContentTable.tsx";
import { TemplatePagesPath } from "@shared/enums";
import { PageTitleComment } from "../PageTitleComment";
import { DisciplineContentHelp } from "../changeable-elements/DisciplineContentHelp";

export function DisciplineContentPage({
  canEditPlan = false,
}: {
  canEditPlan?: boolean;
}) {
  return (
    <Box>
      <PageTitleComment
        title="Содержание дисциплины"
        sx={{ pb: 2 }}
        templateField={TemplatePagesPath.DISCIPLINE_CONTENT}
        fields={["content", "study_load"]}
        actions={<DisciplineContentHelp />}
      />
      <DisciplineContentTable canEditPlan={canEditPlan} />
      <PageTitleComment
        sx={{ py: 2, pt: 3 }}
        title="Содержание дисциплины"
        templateField={`${TemplatePagesPath.DISCIPLINE_CONTENT}_1`}
        fields={["content_more_text", "content_template_more_text"]}
      />
      <JsonChangeValue elementName="content_more_text" />
      <Box sx={{ pt: 1 }}>
        <JsonChangeValue elementName="content_template_more_text" />
      </Box>
    </Box>
  );
}

export default DisciplineContentPage;
