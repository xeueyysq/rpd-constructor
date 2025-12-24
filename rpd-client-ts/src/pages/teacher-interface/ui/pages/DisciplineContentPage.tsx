import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { DisciplineContentTable } from "../changeable-elements/DisciplineContentTable.tsx";
import { PageTitle } from "@shared/ui";
import { CommentChangeValue } from "../changeable-elements/CommentChangeValue.tsx";
import { TemplatePagesPath } from "@pages/teacher-interface/model/pathes.ts";

export function DisciplineContentPage() {
  return (
    <Box>
      <PageTitle title="Содержание дисциплины" paddingBottom={2} />
      <CommentChangeValue templateField={TemplatePagesPath.DISCIPLINE_CONTENT} />
      <DisciplineContentTable />
      <PageTitle py={2} pt={3} title="Содержание дисциплины" />
      <CommentChangeValue templateField={`${TemplatePagesPath.DISCIPLINE_CONTENT}_1`} />
      <JsonChangeValue elementName="content_more_text" />
      <Box pt={1}>
        <JsonChangeValue elementName="content_template_more_text" />
      </Box>
    </Box>
  );
}

export default DisciplineContentPage;
