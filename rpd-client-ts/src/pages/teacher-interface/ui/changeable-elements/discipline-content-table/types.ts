import type { DisciplineContentData } from "@pages/teacher-interface/model/DisciplineContentPageTypes";

export type ContentTableType = {
  tableData?: DisciplineContentData;
  readOnly?: boolean;
  canEditPlan?: boolean;
};
export type DisciplineContentRow = DisciplineContentData[string];
export type EditableRowKey =
  "theme" | "lectures" | "seminars" | "control" | "independent_work";
