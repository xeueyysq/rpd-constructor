import { axiosBase } from "@shared/api";
import { DisciplineContentData } from "@pages/teacher-interface/model/DisciplineContentPageTypes";
import { StudyLoadSaveItem } from "./types";

type SaveDisciplineContentParams = {
  templateId: number;
  content: DisciplineContentData;
  studyLoad: StudyLoadSaveItem[] | null;
};

export async function saveDisciplineContent({
  templateId,
  content,
  studyLoad,
}: SaveDisciplineContentParams) {
  const requests = [
    axiosBase.put(`update-json-value/${templateId}`, {
      fieldToUpdate: "content",
      value: content,
    }),
  ];

  if (studyLoad) {
    requests.push(
      axiosBase.put(`update-json-value/${templateId}`, {
        fieldToUpdate: "study_load",
        value: studyLoad,
      })
    );
  }

  await Promise.all(requests);
}
