import type { NextFunction, Request, Response } from "express";
import * as Yup from "yup";
import validateRequest from "../utils/ValidateRequest.ts";

const EDITABLE_TEMPLATE_FIELDS = new Set([
  "content", "competencies", "certification", "assessment_tools_questions",
  "goals", "place_more_text", "content_more_text", "content_template_more_text",
  "textbook", "additional_textbook", "professional_information_resources",
  "software", "logistics_template", "methodological_support_template",
]);

function isEditableTemplateField(value: unknown): value is string {
  return typeof value === "string" && EDITABLE_TEMPLATE_FIELDS.has(value);
}

const hour = Yup.number().strict().min(0).test("finite", "Часы должны быть конечным числом", (value) => value === undefined || Number.isFinite(value));
const studyLoadSchema = Yup.object({
  params: Yup.object({
    id: Yup.string().required().matches(/^[1-9]\d*$/, "Некорректный id")
      .test("safe-id", "Некорректный id", (value) => Number.isSafeInteger(Number(value))),
  }).required(),
  body: Yup.object({
    hours: Yup.object({ all: hour, lectures: hour, seminars: hour, control: hour, independent_work: hour })
      .strict().noUnknown(true).optional(),
    zet: hour,
  }).strict().noUnknown(true).required()
    .test("non-empty", "Укажите часы или ЗЕТ", (value) =>
      value?.zet !== undefined || (value?.hours !== undefined && Object.keys(value.hours).length > 0)),
});

class RpdProfileTemplatesValidator {
  static async studyLoad(req: Request, res: Response, next: NextFunction) {
    return validateRequest(req, res, next, studyLoadSchema);
  }
}

export { EDITABLE_TEMPLATE_FIELDS, isEditableTemplateField, studyLoadSchema };
export default RpdProfileTemplatesValidator;
