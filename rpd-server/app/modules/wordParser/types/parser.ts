import type { DisciplineJson } from "./discipline.ts";
import type { ValidationIssue } from "./validation.ts";

export type DocumentBlock =
  | {
      type: "paragraph";
      text: string;
      index: number;
    }
  | {
      type: "table";
      rows: string[][];
      index: number;
    };

export type SectionKey =
  | "goals"
  | "place"
  | "competencies"
  | "volume"
  | "content"
  | "methodologicalSupport"
  | "assessmentTools"
  | "resources"
  | "literature"
  | "software"
  | "materialSupport";

export type DocumentSections = {
  preSection: DocumentBlock[];
} & {
  [K in SectionKey]?: DocumentBlock[];
};

export type FieldConfidenceSource =
  | "exact-heading"
  | "regex"
  | "table"
  | "rule-based"
  | "heuristic"
  | "manual"
  | "missing";

export type FieldValidation = {
  field: string;
  key: string;
  status: "success" | "warning" | "error" | "info";
  value: string;
  message: string;
  confidence: number;
  /** Откуда взята оценка (док. 03, §7). */
  source: FieldConfidenceSource;
  /** Пояснение для низкой уверенности. */
  detail?: string;
};

export type ValidationResult = FieldValidation[];

export type ExtractedSectionView = {
  id: string;
  title: string;
  found: boolean;
  charCount: number;
  rawText: string;
  fieldsSummary: string;
};

export type ExtractedSections = {
  order: string[];
  sections: Record<string, ExtractedSectionView>;
};

export type ConvertResponse = {
  ok: boolean;
  fileName: string;
  json: DisciplineJson | null;
  sections: ExtractedSections | null;
  validation: ValidationResult;
  confidence: Record<string, number>;
  warnings: string[];
  errors: string[];
  /** Коды вида E_NOT_DOCX для отчётов и интеграций */
  errorCodes?: string[];
  /** SHA-256 входного файла (один .docx или один .docx из ZIP) */
  fileSha256?: string;
  /** Версия конвейера парсинга */
  parserVersion?: string;
  /** Семантика и кросс-поля (production-дополнение) */
  issues?: ValidationIssue[];
};

export type BatchConvertResponse = {
  ok: boolean;
  total: number;
  success: number;
  failed: number;
  results: ConvertResponse[];
  parserVersion?: string;
};
