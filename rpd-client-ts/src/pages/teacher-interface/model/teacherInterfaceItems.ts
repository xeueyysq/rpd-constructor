import { RpdListItem } from "@widgets/rpd-list";
import { TemplatePagesPath } from "./pathes";

export const TeacherRpdListItems: RpdListItem[] = [
  {
    id: "coverPage",
    text: "Титульный лист",
    path: TemplatePagesPath.COVER_PAGE,
  },
  {
    id: "approvalPage",
    text: "Лист согласования (В разработке)",
    path: TemplatePagesPath.APPROVAL_PAGE,
  },
  {
    id: "aimsPage",
    text: "Цели и задачи освоения дисциплины",
    path: TemplatePagesPath.AIMS_PAGE,
  },
  {
    id: "disciplinePlace",
    text: "Место дисциплины в структуре ОПОП",
    path: TemplatePagesPath.DISCIPLINE_PLACE,
  },
  {
    id: "disciplinePlannedResults",
    text: "Планируемые результаты обучения по дисциплине (модулю)",
    path: TemplatePagesPath.DISCIPLINE_PLANNED_RESULTS,
  },
  {
    id: "disciplineScope",
    text: "Объем дисциплины",
    path: TemplatePagesPath.DISCIPLINE_SCOPE,
  },
  {
    id: "disciplineContent",
    text: "Содержание дисциплины",
    path: TemplatePagesPath.DISCIPLINE_CONTENT,
  },
  {
    id: "disciplineSupport",
    text: "Перечень учебно-методического обеспечения по дисциплине",
    path: TemplatePagesPath.DISCIPLINE_SUPPORT,
  },
  {
    id: "disciplineEvaluationsFunds",
    text: "Фонды оценочных средств по дисциплине",
    path: TemplatePagesPath.DISCIPLINE_EVALUATIONS_FUNDS,
  },
  {
    id: "resourceSupport",
    text: "Ресурсное обеспечение",
    path: TemplatePagesPath.RESOURCE_SUPPORT,
  },
];
