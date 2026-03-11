export type AssessmentToolsQuestionsData = {
  controlQuestions: string;
  competencies: Record<string, { openQuestions: string; closedQuestions: string }>;
};

export type CompetenceGroup = {
  competence: string;
};
