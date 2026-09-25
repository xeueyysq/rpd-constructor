import { Box, Container } from "@mui/material";
import { FC, useState } from "react";
import { RpdList } from "@widgets/rpd-list";
import { RpdCoverPage } from "./RpdCoverPage";
import { RpdListItems } from "../model/rpdTemplateItems";

export const RPDTemplate: FC = () => {
  const [choise, setChoise] = useState<string>("coverPage");

  return (
    <Container
      maxWidth="xl"
      sx={{
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <Box sx={{ minWidth: 400, maxWidth: 400, my: 4, mr: 2 }}>
        <Box
          sx={{
            height: 550,
            py: 1,
            position: "sticky",
            top: "20px",
            backgroundColor: "#fefefe",
          }}
        >
          <RpdList
            RpdListItems={RpdListItems}
            setChoise={setChoise}
            selectedId={choise}
          />
        </Box>
      </Box>
      <Box
        sx={{ my: 4, p: 2, ml: 2, backgroundColor: "#fefefe", width: "100%" }}
      >
        {choise === "coverPage" && <RpdCoverPage />}
      </Box>
    </Container>
  );
};
