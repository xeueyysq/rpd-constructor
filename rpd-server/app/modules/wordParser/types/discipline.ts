export type DisciplineJson = {
  disciplins_name: string | null;
  department: string | null;
  teacher: string | null;

  goals: string | null;
  place: string | null;
  semester: number | null;
  certification: string | null;
  place_more_text: string | null;

  competencies: Record<string, CompetencyItem>;

  zet: number | null;

  content: Record<string, ContentItem>;
  content_more_text: string | null;
  content_template_more_text: string | null;

  methodological_support_template: string | null;
  assessment_tools_template: string | null;

  textbook: string[] | null;
  additional_textbook: string[] | null;
  professional_information_resources: string[] | null;
  software: string | null;

  faculty: string | null;
  direction: string | null;
  profile: string | null;
  education_level: string | null;
  education_form: string | null;
  year: number | null;
};

export type CompetencyItem = {
  code: string;
  name: string;
  indicators: {
    code: string | null;
    text: string;
  }[];
  results: {
    know?: string[];
    can?: string[];
    own?: string[];
    raw?: string[];
  };
};

export type ContentItem = {
  title: string;
  total_hours?: number | null;
  lectures?: number | null;
  practice?: number | null;
  labs?: number | null;
  independent_work?: number | null;
  semester?: number | null;
  raw?: string[];
};
