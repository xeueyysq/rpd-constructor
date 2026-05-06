export type AssessmentToolQuestionId = string;

export type AssessmentToolQuestion = {
  id: AssessmentToolQuestionId;
  text: string;
  correctAnswer?: string;
};

export type CompetenceAssessmentQuestions = {
  openQuestions: string;
  closedQuestions: string;
  openPool?: AssessmentToolQuestion[];
  closedPool?: AssessmentToolQuestion[];
  selectedOpenIds?: AssessmentToolQuestionId[];
  selectedClosedIds?: AssessmentToolQuestionId[];
};

export type AssessmentToolsQuestionsData = {
  controlQuestions: string;
  competencies: Record<string, CompetenceAssessmentQuestions>;
};

export type CompetenceGroup = {
  competence: string;
};

export type PlannedResultsData = Record<
  string,
  {
    competence: string;
    indicator: string;
    results: {
      know: string;
      beAble: string;
      own: string;
    };
  }
>;
