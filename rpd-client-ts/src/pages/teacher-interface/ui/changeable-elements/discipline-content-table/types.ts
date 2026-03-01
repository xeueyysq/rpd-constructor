import {
  DisciplineContentData,
  ObjectHours,
} from "@pages/teacher-interface/model/DisciplineContentPageTypes";

export type ContentTableType = {
  tableData?: DisciplineContentData;
  readOnly?: boolean;
};

export interface StudyLoad {
  id: string;
  name: string;
}

export type StudyLoadCategory =
  | "total"
  | "lectures"
  | "seminars"
  | "independent"
  | "control"
  | "unknown";

export type DisciplineContentRow = DisciplineContentData[string];

export type EditableRowKey =
  | "theme"
  | "lectures"
  | "seminars"
  | "control"
  | "independent_work";

export type StudyLoadSaveItem = { name: string; id: string };

export const ATTESTATION_ROW_ID = "__attestation__";

export const EMPTY_HOURS: ObjectHours = {
  all: 0,
  lectures: 0,
  seminars: 0,
  control: 0,
  lect_and_sems: 0,
  independent_work: 0,
};
