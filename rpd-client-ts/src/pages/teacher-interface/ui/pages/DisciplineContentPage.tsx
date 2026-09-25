import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { DisciplineContentTable } from "../changeable-elements/DisciplineContentTable.tsx";
import { TemplatePagesPath } from "@shared/enums";
import { PageTitleComment } from "../PageTitleComment";

export function DisciplineContentPage() {
  return (
    <Box>
      <PageTitleComment
        title="Содержание дисциплины"
        sx={{ pb: 2 }}
        templateField={TemplatePagesPath.DISCIPLINE_CONTENT}
      />
      <DisciplineContentTable />
      <PageTitleComment
        sx={{ py: 2, pt: 3 }}
        title="Содержание дисциплины"
        templateField={`${TemplatePagesPath.DISCIPLINE_CONTENT}_1`}
      />
      <JsonChangeValue elementName="content_more_text" />
      <Box sx={{ pt: 1 }}>
        <JsonChangeValue elementName="content_template_more_text" />
      </Box>
    </Box>
  );
}

export default DisciplineContentPage;
