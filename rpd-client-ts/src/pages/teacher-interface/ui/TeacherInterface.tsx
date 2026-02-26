import { Box } from "@mui/material";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import { showErrorMessage } from "@shared/lib/showMessage.ts";
import { useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { TemplatePagesPath } from "../model/pathes.ts";
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
  const { toggleDrawer, setJsonData, updateJsonData, setComplectId, jsonData } =
    useStore((state) => state);
  const { id: templateId, page = TemplatePagesPath.COVER_PAGE } = useParams();

  const deriveCertificationFromStudyLoad = (
    studyLoad: unknown
  ): string | undefined => {
    if (!Array.isArray(studyLoad)) return;
    for (const item of studyLoad as Array<{ name?: unknown }>) {
      const name = String(item?.name ?? "").toLowerCase();
      if (name.includes("экзам")) return "Экзамен";
      if (name.includes("зач") && name.includes("оцен"))
        return "Зачет с оценкой";
      if (name.includes("зач")) return "Зачет";
    }
  };

  const deriveCertificationFromControlLoad = (
    controlLoad: unknown
  ): string | undefined => {
    if (!controlLoad || typeof controlLoad !== "object" || Array.isArray(controlLoad))
      return;
    const keys = Object.keys(controlLoad as Record<string, unknown>);
    return keys.length > 0 ? keys[0] : undefined;
  };

  const uploadTemplateData = useCallback(async () => {
    try {
      const response = await axiosBase.post("rpd-profile-templates", {
        id: templateId,
      });
      setJsonData(response.data);
      setComplectId(response.data.id_rpd_complect);

      if (!response.data?.certification) {
        const derived =
          deriveCertificationFromStudyLoad(response.data?.study_load) ??
          deriveCertificationFromControlLoad(response.data?.control_load);
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

  const pageMap: Record<string, JSX.Element> = {
    [TemplatePagesPath.COVER_PAGE]: <CoverPage />,
    [TemplatePagesPath.APPROVAL_PAGE]: <ApprovalPage />,
    [TemplatePagesPath.AIMS_PAGE]: <AimsPage />,
    [TemplatePagesPath.DISCIPLINE_PLACE]: <DisciplinePlace />,
    [TemplatePagesPath.DISCIPLINE_PLANNED_RESULTS]: <PlannedResultsPage />,
    [TemplatePagesPath.DISCIPLINE_SCOPE]: <ScopeDisciplinePage />,
    [TemplatePagesPath.DISCIPLINE_CONTENT]: <DisciplineContentPage />,
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
