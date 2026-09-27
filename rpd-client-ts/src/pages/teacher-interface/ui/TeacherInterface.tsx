import { Box } from "@mui/material";
import { useAuth } from "@entities/auth";
import { axiosBase } from "@shared/api";
import { UserRole } from "@shared/ability";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib/showMessage.ts";
import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { TemplatePagesPath } from "@shared/enums";
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
import { Loader } from "@shared/ui/Loader.tsx";

export function TeacherInterface() {
  const { toggleDrawer, setJsonData, setComplectId, jsonData } = useStore(
    (state) => state
  );
  const userRole = useAuth((state) => state.userRole);
  const isTeacher = userRole === UserRole.TEACHER;
  const { id: templateId, page = TemplatePagesPath.COVER_PAGE } = useParams();

  const uploadTemplateData = useCallback(async () => {
    try {
      const response = await axiosBase.post("rpd-profile-templates", {
        id: templateId,
      });
      setJsonData({
        ...response.data,
        certification:
          response.data.certification || response.data.derived_certification,
      });
      setComplectId(response.data.id_rpd_complect);
    } catch (error) {
      showErrorMessage("Ошибка при получении данных");
      console.error(error);
    }
  }, [setJsonData, templateId, setComplectId]);

  useEffect(() => {
    uploadTemplateData();
    if (!useStore.getState().isDrawerOpen) toggleDrawer();
  }, [templateId]);

  const pageMap: Record<string, JSX.Element> = {
    [TemplatePagesPath.COVER_PAGE]: <CoverPage />,
    [TemplatePagesPath.APPROVAL_PAGE]: <ApprovalPage />,
    [TemplatePagesPath.AIMS_PAGE]: <AimsPage />,
    [TemplatePagesPath.DISCIPLINE_PLACE]: (
      <DisciplinePlace readOnly={isTeacher} />
    ),
    [TemplatePagesPath.DISCIPLINE_PLANNED_RESULTS]: <PlannedResultsPage />,
    [TemplatePagesPath.DISCIPLINE_SCOPE]: (
      <ScopeDisciplinePage readOnly={isTeacher} />
    ),
    [TemplatePagesPath.DISCIPLINE_CONTENT]: (
      <DisciplineContentPage canEditPlan={!isTeacher} />
    ),
    [TemplatePagesPath.DISCIPLINE_SUPPORT]: <DisciplineSupportPage />,
    [TemplatePagesPath.DISCIPLINE_EVALUATIONS_FUNDS]: (
      <DisciplineEvaluationsFunds />
    ),
    [TemplatePagesPath.RESOURCE_SUPPORT]: <ResourceSupportPage />,
    [TemplatePagesPath.TEST_PDF]: <TestPdf />,
  };

  if (!jsonData?.id) return <Loader />;

  return (
    <Box>
      <Box sx={{ backgroundColor: "#ffffff", p: 3, minHeight: "100vh" }}>
        {pageMap[page]}
      </Box>
    </Box>
  );
}
