import { FC, useState } from "react";
import { Box, Container } from "@mui/material";
import { RpdList } from "@widgets/rpd-list";
import { TeacherRpdListItems } from "../model/teacherInterfaceItems.ts";

import AimsPage from "./pages/AimsPage.tsx";
import ApprovalPage from "./pages/ApprovalPage.tsx";
import CoverPage from "./pages/CoverPage.tsx";
import DisciplineContentPage from "./pages/DisciplineContentPage.tsx";
import DisciplineEvaluationsFunds from "./pages/DisciplineEvaluationsFunds.tsx";
import DisciplinePlace from "./pages/DisciplinePlace.tsx";
import DisciplineSupportPage from "./pages/DisciplineSupportPage.tsx";
import PlannedResultsPage from "./pages/PlannedResultsPage.tsx";
import ResourceSupportPage from "./pages/ResourceSupportPage.tsx";
import ScopeDisciplinePage from "./pages/ScopeDisciplinePage.tsx";
import TestPdf from "./pdf-page/TestPdf.tsx"; // Assuming PDF Test view
import { useAuth } from "@entities/auth";
import { useStore } from "@shared/hooks";
import { useNavigate } from "react-router-dom";
import { TeacherInterfaceTemplates } from "./TeacherInterfaceTemplates.tsx";
import { UserRole } from "@shared/ability";

export const TeacherInterface: FC = () => {
  const userRole = useAuth.getState().userRole;
  const [choise, setChoise] = useState<string>(
    userRole === UserRole.ROP ? "coverPage" : "selectTemplate"
  );
  const jsonData = useStore.getState().jsonData;
  const navigate = useNavigate();

  if (!Object.keys(jsonData).length) {
    if (userRole === UserRole.ROP) navigate("/manager");
    if (userRole === UserRole.TEACHER && choise !== "selectTemplate")
      setChoise("selectTemplate");
  }

  return (
    <Container
      maxWidth="xl"
      sx={{ display: "flex", justifyContent: "space-between" }}
    >
      {choise === "selectTemplate" ? (
        <TeacherInterfaceTemplates setChoise={setChoise} />
      ) : (
        <>
          <Box minWidth={400} maxWidth={400} my={4} mr={2}>
            <Box
              py={1}
              sx={{
                position: "sticky",
                top: "20px",
                backgroundColor: "#fefefe",
              }}
            >
              <RpdList
                RpdListItems={TeacherRpdListItems}
                setChoise={setChoise}
              />
            </Box>
          </Box>
          <Box
            my={4}
            p={2}
            ml={2}
            sx={{ backgroundColor: "#fefefe", width: "100%" }}
          >
            {choise === "coverPage" && <CoverPage />}
            {choise === "approvalPage" && <ApprovalPage />}
            {choise === "aimsPage" && <AimsPage />}
            {choise === "disciplinePlace" && <DisciplinePlace />}
            {choise === "disciplinePlannedResults" && <PlannedResultsPage />}
            {choise === "disciplineScope" && <ScopeDisciplinePage />}
            {choise === "disciplineContent" && <DisciplineContentPage />}
            {choise === "disciplineSupport" && <DisciplineSupportPage />}
            {choise === "disciplineEvaluationsFunds" && (
              <DisciplineEvaluationsFunds />
            )}
            {choise === "resourceSupport" && <ResourceSupportPage />}
            {choise === "testPdf" && <TestPdf />}
          </Box>
        </>
      )}
    </Container>
  );
};
