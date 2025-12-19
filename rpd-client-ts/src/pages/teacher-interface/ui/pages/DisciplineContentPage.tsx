import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { DisciplineContentTable } from "../changeable-elements/DisciplineContentTable.tsx";
import { PageTitle } from "@shared/ui";

const DisciplineContentPage: FC = () => {
  // if (!data) return <Loader />

  return (
    <Box>
      <PageTitle title="Содержание дисциплины" />
      <DisciplineContentTable />
      <PageTitle py={2} pt={3} title="Содержание дисциплины" />
      <Box
        sx={{
          p: 1,
          border: "1px dashed grey",
          my: 1,
          "& ul": {
            p: 1,
          },
          "& li": {
            ml: "60px",
          },
          "& p": {
            p: 1,
          },
        }}
      >
        <JsonChangeValue elementName="content_more_text" />
      </Box>
      <Box
        sx={{
          p: 1,
          border: "1px dashed grey",
          my: 1,
          "& p": {
            p: 1,
          },
        }}
      >
        <JsonChangeValue elementName="content_template_more_text" />
      </Box>
    </Box>
  );
};

export default DisciplineContentPage;
