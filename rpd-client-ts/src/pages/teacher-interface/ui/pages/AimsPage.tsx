import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { PageTitle } from "@shared/ui";

const AimsPage: FC = () => {
  return (
    <Box>
      <PageTitle title="Цели и задачи освоения дисциплины" paddingBottom={2} />
      <JsonChangeValue elementName="goals" />
    </Box>
  );
};

export default AimsPage;
