import { z } from "zod";

export const disciplineJsonSchema = z.object({
  disciplins_name: z.string().nullable(),
  department: z.string().nullable(),
  teacher: z.string().nullable(),

  goals: z.string().nullable(),
  place: z.string().nullable(),
  semester: z.number().nullable(),
  certification: z.string().nullable(),
  place_more_text: z.string().nullable(),

  competencies: z.record(z.string(), z.unknown()),

  zet: z.number().nullable(),

  content: z.record(z.string(), z.unknown()),
  content_more_text: z.string().nullable(),
  content_template_more_text: z.string().nullable(),

  methodological_support_template: z.string().nullable(),
  assessment_tools_template: z.string().nullable(),

  textbook: z.array(z.string()).nullable(),
  additional_textbook: z.array(z.string()).nullable(),
  professional_information_resources: z.array(z.string()).nullable(),
  software: z.string().nullable(),

  faculty: z.string().nullable(),
  direction: z.string().nullable(),
  profile: z.string().nullable(),
  education_level: z.string().nullable(),
  education_form: z.string().nullable(),
  year: z.number().nullable(),
});

export type DisciplineJsonSchema = z.infer<typeof disciplineJsonSchema>;
