interface DisciplineContent {
  theme: string;
  lectures: number;
  seminars: number;
  independent_work: number;
  competence: string;
  indicator: string;
  results: string;
}

export interface JsonChangeValueTypes {
  elementName: string;
}

export interface Results {
  know: string;
  beAble: string;
  own: string;
}

interface PlannedResults {
  competence: string;
  indicator: string;
  results: Results;
}

export interface ObjectHours {
  all: number;
  lectures: number;
  seminars: number;
  lect_and_sems: number;
  independent_work: number;
}

export interface DisciplineContentData {
  [id: string]: DisciplineContent;
}

export interface PlannedResultsData {
  [id: string]: PlannedResults;
}
