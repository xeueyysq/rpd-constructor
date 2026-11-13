import type { CompetencyItem, DisciplineJson } from "../../types/discipline.ts";
import type {
  ConvertResponse,
  DocumentBlock,
  ExtractedSectionView,
  ExtractedSections,
  FieldConfidenceSource,
  FieldValidation,
  ValidationResult,
} from "../../types/parser.ts";
import { extractMammothRawText } from "../docx/extract-mammoth.ts";
import { countRpdMarkers, explainIfNonWorkProgramDocx } from "../docx/non-rpd-guard.ts";
import { readDocxToBlocks } from "../docx/read-docx.ts";
import { ErrorCode } from "../errors/error-codes.ts";
import { PARSER_VERSION } from "../utils/parser-version.ts";
import { splitDocumentIntoSections } from "./section-detector.ts";
import { parseTitleBlock } from "./title-block-parser.ts";
import { parseGoalsSection } from "./goals-parser.ts";
import { parsePlaceSection } from "./place-parser.ts";
import { parseCompetenciesSection } from "./competencies-parser.ts";
import { parseVolumeSection } from "./volume-parser.ts";
import { parseContentSection, type ContentParseMeta } from "./content-parser.ts";
import { parseMethodologicalSection, parseAssessmentSection } from "./support-parser.ts";
import { parseResourceBlocks } from "./resources-parser.ts";
import { validateDisciplineJson } from "../json/validate-discipline-json.ts";
import {
  defaultConfidenceMap,
  type ConfidenceMap,
  HIGH,
  LOW,
  MID,
  NONE,
  VLOW,
} from "../utils/confidence.ts";
import { blocksToText } from "../utils/text.ts";
import { runCrossFieldValidation } from "../validation/cross-field-validation.ts";
import { runSemanticValidation } from "../validation/semantic-validation.ts";
import type { ValidationIssue } from "../../types/validation.ts";

const LABEL: Record<keyof DisciplineJson, string> = {
  disciplins_name: "Название дисциплины",
  department: "Кафедра",
  teacher: "Автор",
  goals: "Цели",
  place: "Место дисциплины",
  semester: "Семестр",
  certification: "Аттестация",
  place_more_text: "Доп. текст места",
  competencies: "Компетенции",
  zet: "Зачётные единицы",
  content: "Содержание",
  content_more_text: "Доп. к содержанию",
  content_template_more_text: "Шаблон содержания",
  methodological_support_template: "Методическое обеспечение",
  assessment_tools_template: "Фонд оценочных средств",
  textbook: "Основная литература",
  additional_textbook: "Доп. литература",
  professional_information_resources: "Проф. ресурсы",
  software: "ПО",
  faculty: "Институт",
  direction: "Направление",
  profile: "Профиль",
  education_level: "Уровень образования",
  education_form: "Форма обучения",
  year: "Год",
};

function makeSection(
  id: string,
  title: string,
  found: boolean,
  rawText: string,
  fieldsSummary: string,
): ExtractedSectionView {
  return {
    id,
    title,
    found,
    charCount: rawText.length,
    rawText: rawText.length > 12000 ? `${rawText.slice(0, 12000)}…` : rawText,
    fieldsSummary,
  };
}

function mergeBlocks(...parts: (DocumentBlock[] | undefined)[]): DocumentBlock[] {
  return parts.filter(Boolean).flat() as DocumentBlock[];
}

function confidenceToSource(
  c: number,
): { source: FieldConfidenceSource; detail: string } {
  if (c >= 0.9) {
    return { source: "heuristic", detail: "Оценка по эвристике парсера; совпадение сильное." };
  }
  if (c >= 0.7) {
    return { source: "heuristic", detail: "Найдено, рекомендуется быстрая сверка с документом." };
  }
  if (c >= 0.4) {
    return { source: "heuristic", detail: "Слабая уверенность, значение эвристическое." };
  }
  return { source: "missing", detail: "Поле пустое или не распознано." };
}

function buildValidation(
  json: DisciplineJson,
  conf: ConfidenceMap,
  warnings: string[],
  contentMeta?: ContentParseMeta,
): ValidationResult {
  const out: FieldValidation[] = (Object.keys(LABEL) as (keyof DisciplineJson)[]).map(
    (k) => {
      const v = json[k];
      const c = conf[k] ?? NONE;
      let display: string;
      if (v == null) {
        display = "—";
      } else if (typeof v === "string") {
        display = v.length > 80 ? `${v.slice(0, 80)}…` : v;
      } else if (typeof v === "object") {
        display = Object.keys(v as object).length
          ? `записей: ${Object.keys(v as object).length}`
          : "—";
      } else {
        display = String(v);
      }
      let { source, detail } = confidenceToSource(c);
      if (k === "content" && contentMeta?.hadHoursTable && c >= 0.85) {
        source = "table";
        detail = "Блок найден по структуре таблицы содержания (часы по темам).";
      } else if (
        k === "content_template_more_text" &&
        contentMeta?.hadSectionDescriptionTable &&
        json.content_template_more_text
      ) {
        source = "rule-based";
        detail = "Блок найден по структуре таблицы содержания разделов.";
      } else if (
        k === "content_more_text" &&
        contentMeta?.contentMoreTextRuleBased &&
        json.content_more_text
      ) {
        source = "rule-based";
        detail = "Блок найден по маркеру практической подготовки.";
      }
      let status: FieldValidation["status"] = "success";
      let message = "";
      if (c < 0.4) {
        status = "error";
        message = "Поле не найдено или заполнено слабо";
      } else if (c < 0.7) {
        status = "warning";
        message = "Требуется проверка";
      } else if (c < 0.9) {
        status = "info";
        message = "Проверьте по документу";
      }
      const w = warnings.find((x) => x.toLowerCase().includes(String(k).toLowerCase()));
      if (w) {
        message = w;
        status = "warning";
      }
      const showDetail =
        c < 0.9 ||
        (k === "content" && contentMeta?.hadHoursTable) ||
        (k === "content_template_more_text" && contentMeta?.hadSectionDescriptionTable) ||
        (k === "content_more_text" && contentMeta?.contentMoreTextRuleBased);

      return {
        field: `${LABEL[k]} (${String(k)})`,
        key: String(k),
        status,
        value: display,
        message,
        confidence: c,
        source,
        detail: showDetail ? detail : undefined,
      };
    },
  );
  return out;
}

export async function buildFullDocumentResult(
  data: ArrayBuffer,
  fileName: string,
): Promise<ConvertResponse> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { blocks, error: readError } = await readDocxToBlocks(data);
  if (readError) {
    errors.push("Не удалось прочитать структуру документа. Проверьте, что это корректный DOCX.");
  }
  if (!blocks.length) {
    errors.push("Пустой документ или нет извлечённых блоков.");
  }

  const mammoth = await extractMammothRawText(data);
  if (mammoth.error) {
    warnings.push("Дополнительное извлечение текста (mammoth) завершилось с предупреждением.");
  }

  const plainForGuard = [mammoth.value, blocksToText(blocks)].filter(Boolean).join("\n");
  const nonRpd = explainIfNonWorkProgramDocx(fileName, plainForGuard);
  if (nonRpd) {
    return {
      ok: false,
      fileName,
      json: null,
      sections: null,
      validation: [],
      confidence: {},
      warnings: [],
      errors: [nonRpd],
      errorCodes: [ErrorCode.E_NOT_WORK_PROGRAM],
      parserVersion: PARSER_VERSION,
    };
  }

  const sections = splitDocumentIntoSections(blocks);
  const title = parseTitleBlock(sections.preSection, {
    sourceFileName: fileName,
    allowFileNameFallback: countRpdMarkers(plainForGuard) >= 2,
  });

  if (!title.disciplins_name) {
    warnings.push('Поле «Название дисциплины» не найдено. Проверьте титульный лист (фраза «Рабочая программа дисциплины»).');
  }

  const sectionRuntimeIssues: ValidationIssue[] = [];

  const goals = parseGoalsSection(sections.goals);
  const place = parsePlaceSection(sections.place);

  let comp: { competencies: Record<string, CompetencyItem>; rawText: string };
  try {
    comp = parseCompetenciesSection(sections.competencies);
    if (Object.keys(comp.competencies).length === 0) {
      const fallbackComp = parseCompetenciesSection(blocks);
      if (Object.keys(fallbackComp.competencies).length > 0) {
        comp = fallbackComp;
      } else {
        warnings.push("competencies: таблица распознана частично");
      }
    }
  } catch {
    comp = { competencies: {}, rawText: "" };
    sectionRuntimeIssues.push({
      code: "COMPETENCY_PARSE_RUNTIME_ERROR",
      severity: "error",
      field: "competencies",
      message:
        "Компетенции не удалось разобрать автоматически. Документ сохранён в JSON, требуется ручная проверка.",
    });
    warnings.push("competencies: внутренняя ошибка разбора — см. issues");
  }

  const vol = parseVolumeSection(sections.volume);

  let cont: ReturnType<typeof parseContentSection>;
  try {
    cont = parseContentSection(sections.content);
  } catch {
    cont = {
      content: {},
      content_more_text: null,
      content_template_more_text: null,
      meta: {
        hadHoursTable: false,
        hadSectionDescriptionTable: false,
        contentMoreTextRuleBased: false,
      },
    };
    sectionRuntimeIssues.push({
      code: "CONTENT_PARSE_RUNTIME_ERROR",
      severity: "error",
      field: "content",
      message:
        "Содержание дисциплины не удалось разобрать автоматически. Проверьте таблицу вручную.",
    });
    warnings.push("content: внутренняя ошибка разбора — см. issues");
  }
  if (cont.content && Object.keys(cont.content).length === 0) {
    warnings.push("content: не удалось сопоставить часть часов");
  }
  const meth = parseMethodologicalSection(sections.methodologicalSupport);
  const ass = parseAssessmentSection(sections.assessmentTools);

  const resBlocks = mergeBlocks(sections.literature, sections.resources, sections.software);
  let res: ReturnType<typeof parseResourceBlocks>;
  try {
    res = parseResourceBlocks(resBlocks.length ? resBlocks : sections.resources);
  } catch {
    res = {
      textbook: null,
      additional_textbook: null,
      professional_information_resources: null,
      software: null,
    };
    sectionRuntimeIssues.push({
      code: "RESOURCES_PARSE_RUNTIME_ERROR",
      severity: "warning",
      field: "resources",
      message:
        "Ресурсное обеспечение разобрано частично из-за внутренней ошибки парсера.",
    });
    warnings.push("resources: внутренняя ошибка разбора — см. issues");
  }

  if (!res.software && sections.software?.length) {
    warnings.push("software: раздел не найден в явном виде");
  }
  if (!res.textbook) {
    const fromLit = parseResourceBlocks(sections.literature);
    if (fromLit.textbook?.length) {
      Object.assign(res, { textbook: fromLit.textbook });
    }
  }

  const json: DisciplineJson = {
    disciplins_name: title.disciplins_name,
    department: title.department,
    teacher: title.teacher,
    goals: goals.text,
    place: place.place,
    semester: place.semester,
    certification: place.certification,
    place_more_text: place.place_more_text,
    competencies: comp.competencies,
    zet: vol.zet,
    content: cont.content,
    content_more_text: cont.content_more_text,
    content_template_more_text: cont.content_template_more_text,
    methodological_support_template: meth,
    assessment_tools_template: ass,
    textbook: res.textbook,
    additional_textbook: res.additional_textbook,
    professional_information_resources: res.professional_information_resources,
    software: res.software,
    faculty: title.faculty,
    direction: title.direction,
    profile: title.profile,
    education_level: title.education_level,
    education_form: title.education_form,
    year: title.year,
  };

  const v = validateDisciplineJson(json);
  if (!v.success) {
    warnings.push("Внутренняя проверка JSON: " + v.error);
  }

  const conf: ConfidenceMap = defaultConfidenceMap(json, {
    disciplins_name: title.disciplins_name ? HIGH : VLOW,
    department: title.department ? HIGH : NONE,
    teacher: title.teacher ? (title.teacher.length > 3 ? MID : LOW) : VLOW,
    goals: json.goals ? HIGH : VLOW,
    place: json.place ? MID : VLOW,
    semester: json.semester != null ? HIGH : VLOW,
    certification: json.certification ? HIGH : VLOW,
    place_more_text: json.place_more_text ? MID : NONE,
    competencies: Object.keys(json.competencies).length > 0 ? MID : VLOW,
    zet: json.zet != null ? HIGH : VLOW,
    content: Object.keys(json.content).length
      ? cont.meta.hadHoursTable
        ? HIGH
        : MID
      : VLOW,
    content_more_text: json.content_more_text
      ? cont.meta.contentMoreTextRuleBased
        ? 0.88
        : 0.5
      : NONE,
    content_template_more_text: json.content_template_more_text
      ? cont.meta.hadSectionDescriptionTable
        ? 0.88
        : 0.5
      : NONE,
    methodological_support_template: json.methodological_support_template ? MID : VLOW,
    assessment_tools_template: json.assessment_tools_template ? MID : VLOW,
    textbook: json.textbook?.length ? HIGH : VLOW,
    additional_textbook: json.additional_textbook?.length ? MID : NONE,
    professional_information_resources: json.professional_information_resources?.length
      ? MID
      : VLOW,
    software: json.software ? MID : VLOW,
    faculty: json.faculty ? HIGH : VLOW,
    direction: json.direction ? HIGH : VLOW,
    profile: json.profile ? HIGH : VLOW,
    education_level: json.education_level ? HIGH : VLOW,
    education_form: json.education_form ? HIGH : VLOW,
    year: json.year != null ? HIGH : VLOW,
  });

  if (!title.teacher) {
    warnings.push("teacher: низкая уверенность, проверьте ФИО автора");
  }

  const extracted: ExtractedSections = {
    order: [
      "title",
      "goals",
      "place",
      "competencies",
      "volume",
      "content",
      "method",
      "assessment",
      "resources",
    ],
    sections: {
      title: makeSection(
        "title",
        "Титульный блок",
        Boolean(title.disciplins_name),
        title.raw,
        [
          title.faculty,
          title.department,
          title.direction,
          title.teacher,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      goals: makeSection(
        "goals",
        "Цели и задачи",
        Boolean(goals.text),
        goals.text || "",
        goals.text ? "текст извлечён" : "не найдено",
      ),
      place: makeSection(
        "place",
        "Место дисциплины",
        Boolean(place.place || place.semester),
        blocksToText(sections.place || []),
        [place.place, place.semester != null ? `семестр ${place.semester}` : ""]
          .filter(Boolean)
          .join(", "),
      ),
      competencies: makeSection(
        "competencies",
        "Компетенции",
        Object.keys(comp.competencies).length > 0,
        comp.rawText,
        `коды: ${Object.keys(comp.competencies).join(", ")}`,
      ),
      volume: makeSection(
        "volume",
        "Объём дисциплины",
        vol.zet != null,
        blocksToText(sections.volume || []),
        vol.zet != null ? `ЗЕТ: ${vol.zet}` : "—",
      ),
      content: makeSection(
        "content",
        "Содержание",
        Object.keys(cont.content).length > 0,
        blocksToText(sections.content || []),
        `разделов: ${Object.keys(cont.content).length}`,
      ),
      method: makeSection(
        "method",
        "Методическое обеспечение",
        Boolean(meth),
        meth || "",
        meth ? "есть" : "нет",
      ),
      assessment: makeSection(
        "assessment",
        "Фонд оценочных средств",
        Boolean(ass),
        ass || "",
        ass ? "есть" : "нет",
      ),
      resources: makeSection(
        "resources",
        "Ресурсное обеспечение",
        Boolean(
          res.textbook?.length ||
            res.professional_information_resources?.length ||
            res.software,
        ),
        [
          (res.textbook || []).join("\n"),
          (res.professional_information_resources || []).join("\n"),
          res.software || "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        "литература, ресурсы, ПО",
      ),
    },
  };

  const fatal = readError != null || blocks.length === 0;

  let issues: ValidationIssue[] = [];
  if (!fatal) {
    issues = [
      ...sectionRuntimeIssues,
      ...runSemanticValidation(json, conf, {
        hasSectionDescriptionTable: cont.meta.hadSectionDescriptionTable,
      }),
      ...runCrossFieldValidation(json),
    ];
  }

  return {
    ok: !fatal,
    fileName,
    json: fatal ? null : json,
    sections: fatal ? null : extracted,
    validation: fatal ? [] : buildValidation(json, conf, warnings, cont.meta),
    confidence: fatal ? {} : conf,
    warnings,
    errors: errors,
    issues: issues.length ? issues : undefined,
  };
}

export type { ConfidenceMap } from "../utils/confidence.ts";
