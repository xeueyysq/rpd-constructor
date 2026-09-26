interface DisciplineContent {
  theme: string;
  lectures: number | null;
  seminars: number | null;
  control?: number | null;
  independent_work: number | null;
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
  control: number;
  contact: number;
  independent_work: number;
}

export interface StudyPlanHours extends ObjectHours {
  has_total: boolean;
  has_breakdown: boolean;
}

export interface DisciplineContentData {
  [id: string]: DisciplineContent;
}

export interface PlannedResultsData {
  [id: string]: PlannedResults;
}
