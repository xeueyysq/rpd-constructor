import { FC } from "react";
import JsonChangeValue from "../changeable-elements/JsonChangeValue.tsx";
import { Box } from "@mui/material";
import { DisciplineContentTable } from "../changeable-elements/DisciplineContentTable.tsx";

const DisciplineContentPage: FC = () => {
  // if (!data) return <Loader />

  return (
    <Box>
      <Box fontSize={"1.5rem"}>Содержание дисциплины</Box>
      <DisciplineContentTable />
      <Box fontSize={"1.5rem"} sx={{ py: 2 }}>
        Содержание дисциплины{" "}
      </Box>
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
