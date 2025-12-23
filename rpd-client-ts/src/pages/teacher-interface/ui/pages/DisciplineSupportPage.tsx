import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { PageTitle } from "@shared/ui";

const DisciplineSupportPage: FC = () => {
  return (
    <Box>
      <PageTitle title="Перечень учебно-методического обеспечения по дисциплине" paddingBottom={2} />
      <JsonChangeValue elementName="methodological_support_template" />
    </Box>
  );
};

export default DisciplineSupportPage;
