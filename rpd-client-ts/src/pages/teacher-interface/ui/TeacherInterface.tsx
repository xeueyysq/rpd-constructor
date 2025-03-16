import { FC, useState } from "react";
import { Box, Container } from "@mui/material";

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
import { UserRole } from "@shared/ability";

export const TeacherInterface: FC = () => {
  // const userRole = useAuth.getState().userRole;
  // const [choise, setChoise] = useState<string>("coverPage");
  // const jsonData = useStore.getState().jsonData;
  // const navigate = useNavigate();

  // if (!Object.keys(jsonData).length) {
  //   if (userRole === UserRole.ROP) navigate("/manager");
  //   if (userRole === UserRole.TEACHER && choise !== "selectTemplate")
  //     setChoise("selectTemplate");
  // }
  const { templatePage } = useStore();

  return (
    <Container maxWidth="md">
      <Box
        p={3}
        sx={{ backgroundColor: "#fefefe" }}
        fontFamily={"Times New Roman"}
        fontSize={18}
      >
        {templatePage === "coverPage" && <CoverPage />}
        {templatePage === "approvalPage" && <ApprovalPage />}
        {templatePage === "aimsPage" && <AimsPage />}
        {templatePage === "disciplinePlace" && <DisciplinePlace />}
        {templatePage === "disciplinePlannedResults" && <PlannedResultsPage />}
        {templatePage === "disciplineScope" && <ScopeDisciplinePage />}
        {templatePage === "disciplineContent" && <DisciplineContentPage />}
        {templatePage === "disciplineSupport" && <DisciplineSupportPage />}
        {templatePage === "disciplineEvaluationsFunds" && (
          <DisciplineEvaluationsFunds />
        )}
        {templatePage === "resourceSupport" && <ResourceSupportPage />}
        {templatePage === "testPdf" && <TestPdf />}
      </Box>
    </Container>
  );
};
