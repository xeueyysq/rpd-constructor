export enum RedirectPath {
  SIGN_IN = "/sign-in",
  MANAGER = "/manager",
  RPD_TEMPLATE = "/rpd-template",
  PLANNED_RESULTS = "/planned-results",
  USER_MANAGEMENT = "/users",
  COMPLECTS = "/complects",
  COMPLECT = "/complects/:id",
  TEMPLATES = "/templates",
  TEMPLATE = "/templates/:id",
  TEMPLATE_SUBPAGE = "/templates/:id/:page?",
}

export enum TemplatePagesPath {
  COVER_PAGE = "coverPage",
  APPROVAL_PAGE = "approvalPage",
  AIMS_PAGE = "aimsPage",
  DISCIPLINE_PLACE = "disciplinePlace",
  DISCIPLINE_PLANNED_RESULTS = "disciplinePlannedResults",
  DISCIPLINE_SCOPE = "disciplineScope",
  DISCIPLINE_CONTENT = "disciplineContent",
  DISCIPLINE_SUPPORT = "disciplineSupport",
  DISCIPLINE_EVALUATIONS_FUNDS = "disciplineEvaluationsFunds",
  RESOURCE_SUPPORT = "resourceSupport",
  TEST_PDF = "testPdf",
}
