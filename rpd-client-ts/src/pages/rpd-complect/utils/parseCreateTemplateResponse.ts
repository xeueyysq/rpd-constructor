import type { CreateTemplateResponse } from "../types";

export type CreateTemplateOutcome =
  | { kind: "success"; message: string; refetch: true }
  | { kind: "error"; message: string; refetch: false }
  | { kind: "warning"; message: string; refetch: false };

export function parseCreateTemplateResponse(response: CreateTemplateResponse): CreateTemplateOutcome {
  const result = typeof response === "string" ? response : (response?.result as string | undefined);
  const missingTeachers =
    typeof response === "object" && response?.missingTeachers?.length ? response.missingTeachers : [];

  if (result === "record exists") {
    return {
      kind: "error",
      message: "Ошибка. Шаблон с текущими данными уже существует",
      refetch: false,
    };
  }

  if (result === "missing_teachers" || missingTeachers.length) {
    return {
      kind: "warning",
      message: `Не найдены пользователи для преподавателей: ${missingTeachers.join(", ")}`,
      refetch: false,
    };
  }

  if (result === "template created") {
    return {
      kind: "success",
      message: "Шаблон успешно создан",
      refetch: true,
    };
  }

  return {
    kind: "error",
    message: "Неизвестный ответ сервера",
    refetch: false,
  };
}

export type CreateTemplateErrorOutcome = { kind: "error"; message: string };

export function parseCreateTemplateError(error: unknown): CreateTemplateErrorOutcome {
  const data =
    error && typeof error === "object" && "response" in error
      ? (error as { response?: { data?: { message?: string; result?: string } } }).response?.data
      : undefined;
  const message = data?.message ?? "Ошибка. Не удалось создать шаблон";
  return { kind: "error", message };
}
