import { Box, Container } from "@mui/material";
import { useEffect } from "react";
import { useStore } from "@shared/hooks";
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
import TestPdf from "./pdf-page/TestPdf.tsx";

export function TeacherInterface() {
  const { templatePage, toggleDrawer } = useStore();

  useEffect(() => {
    if (!useStore.getState().isDrawerOpen) toggleDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box pl={2}>
      <Box sx={{ backgroundColor: "#fefefe" }} fontFamily={"Times New Roman"} fontSize={18}>
        {templatePage === "coverPage" && <CoverPage />}
        {templatePage === "approvalPage" && <ApprovalPage />}
        {templatePage === "aimsPage" && <AimsPage />}
        {templatePage === "disciplinePlace" && <DisciplinePlace />}
        {templatePage === "disciplinePlannedResults" && <PlannedResultsPage />}
        {templatePage === "disciplineScope" && <ScopeDisciplinePage />}
        {templatePage === "disciplineContent" && <DisciplineContentPage />}
        {templatePage === "disciplineSupport" && <DisciplineSupportPage />}
        {templatePage === "disciplineEvaluationsFunds" && <DisciplineEvaluationsFunds />}
        {templatePage === "resourceSupport" && <ResourceSupportPage />}
        {templatePage === "testPdf" && <TestPdf />}
      </Box>
    </Box>
  );
}
