import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { DisciplineContentTable } from "../changeable-elements/DisciplineContentTable.tsx";
import { PageTitle } from "@shared/ui";

export function DisciplineContentPage() {
  return (
    <Box>
      <PageTitle title="Содержание дисциплины" />
      <DisciplineContentTable />
      <PageTitle py={2} pt={3} title="Содержание дисциплины" />
      <JsonChangeValue elementName="content_more_text" />
      <Box pt={1}>
        <JsonChangeValue elementName="content_template_more_text" />
      </Box>
    </Box>
  );
}

export default DisciplineContentPage;
