import { Box } from "@mui/material";
import { axiosBase } from "@shared/api/index.ts";
import { useStore } from "@shared/hooks";
import { showErrorMessage, showWarningMessage } from "@shared/lib/showMessage.ts";
import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  const { templatePage, toggleDrawer, setJsonData, updateJsonData } = useStore();
  const { id: templateId } = useParams();

  const deriveCertificationFromStudyLoad = (studyLoad: unknown): string | undefined => {
    if (!Array.isArray(studyLoad)) return;
    for (const item of studyLoad as Array<{ name?: unknown }>) {
      const name = String(item?.name ?? "").toLowerCase();
      if (name.includes("экзам")) return "Экзамен";
      if (name.includes("зач") && name.includes("оцен")) return "Зачет с оценкой";
      if (name.includes("зач")) return "Зачет";
    }
  };

  const uploadTemplateData = useCallback(async () => {
    try {
      const response = await axiosBase.post("rpd-profile-templates", {
        id: templateId,
      });
      setJsonData(response.data);

      if (!response.data?.certification) {
        const derived = deriveCertificationFromStudyLoad(response.data?.study_load);
        if (derived) {
          updateJsonData("certification", derived);
        }
      }
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [setJsonData, templateId, updateJsonData]);

  useEffect(() => {
    uploadTemplateData();
    if (!useStore.getState().isDrawerOpen) toggleDrawer();
  }, [templateId]);

  return (
    <Box pl={2}>
      <Box sx={{ backgroundColor: "#fefefe" }}>
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
