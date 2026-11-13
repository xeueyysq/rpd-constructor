export type ValidationSeverity = "info" | "warning" | "error" | "critical";

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  field?: string;
  section?: string;
  message: string;
  details?: string;
  suggestion?: string;
};
