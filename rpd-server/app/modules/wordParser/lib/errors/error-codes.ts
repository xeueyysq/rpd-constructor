/**
 * Стабильные коды ошибок (план №2, §40).
 * Используются в API, отчётах и UI.
 */
export const ErrorCode = {
  E_NO_FILE: "E_NO_FILE",
  E_EMPTY: "E_EMPTY",
  E_NOT_DOCX: "E_NOT_DOCX",
  E_NOT_ZIP: "E_NOT_ZIP",
  E_WORD_TEMP: "E_WORD_TEMP",
  E_PDF: "E_PDF",
  E_RTF: "E_RTF",
  E_ODT: "E_ODT",
  E_OLD_DOC: "E_OLD_DOC",
  E_FILE_NAME: "E_FILE_NAME",
  E_BATCH_LIMIT: "E_BATCH_LIMIT",
  E_ZIP_INVALID: "E_ZIP_INVALID",
  E_ZIP_NO_DOCX: "E_ZIP_NO_DOCX",
  E_ZIP_PATH: "E_ZIP_PATH",
  E_ZIP_TOO_MANY: "E_ZIP_TOO_MANY",
  E_ZIP_SIZE: "E_ZIP_SIZE",
  /** word/document.xml отсутствует или нет OOXML-структуры (§8 документа) */
  INVALID_DOCX_CONTAINER: "INVALID_DOCX_CONTAINER",
  E_DOCX_CORRUPT: "E_DOCX_CORRUPT",
  E_PARSE: "E_PARSE",
  E_INTERNAL: "E_INTERNAL",
  /** Файл не РПД (например JSON внутри DOCX) — batch3_semantic_report */
  E_NOT_WORK_PROGRAM: "E_NOT_WORK_PROGRAM",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_MESSAGE_RU: Record<string, string> = {
  [ErrorCode.E_NO_FILE]: "Файл не передан.",
  [ErrorCode.E_EMPTY]: "Пустой файл не поддерживается.",
  [ErrorCode.E_NOT_DOCX]: "Нужен файл .docx (Office Open XML).",
  [ErrorCode.E_NOT_ZIP]: "Нужен архив .zip.",
  [ErrorCode.E_WORD_TEMP]: "Служебные файлы Word (~$…) не обрабатываются.",
  [ErrorCode.E_PDF]: "Формат PDF не поддерживается, загрузите .docx.",
  [ErrorCode.E_RTF]: "Формат RTF не поддерживается.",
  [ErrorCode.E_ODT]: "Формат ODT не поддерживается, используйте .docx.",
  [ErrorCode.E_OLD_DOC]: "Старый формат .doc не поддерживается, сохраните документ как .docx.",
  [ErrorCode.E_FILE_NAME]: "Слишком длинное или недопустимое имя файла.",
  [ErrorCode.E_BATCH_LIMIT]: "Превышен лимит количества файлов в пакете.",
  [ErrorCode.E_ZIP_INVALID]: "Архив повреждён или не является ZIP.",
  [ErrorCode.E_ZIP_NO_DOCX]: "В архиве не найдено ни одного .docx.",
  [ErrorCode.E_ZIP_PATH]: "В архиве обнаружен небезопасный путь (zip slip).",
  [ErrorCode.E_ZIP_TOO_MANY]: "Слишком много файлов в одном ZIP.",
  [ErrorCode.E_ZIP_SIZE]:
    "Превышен допустимый размер файла или распаковки (защита от zip bomb).",
  [ErrorCode.INVALID_DOCX_CONTAINER]:
    "Файл не является корректным DOCX: нет word/document.xml или сигнатуры ZIP (Office Open XML).",
  [ErrorCode.E_DOCX_CORRUPT]: "Не удалось прочитать DOCX, файл может быть повреждён.",
  [ErrorCode.E_PARSE]: "Внутренняя ошибка разбора документа.",
  [ErrorCode.E_INTERNAL]: "Внутренняя ошибка сервера.",
  [ErrorCode.E_NOT_WORK_PROGRAM]:
    "Файл не является рабочей программой дисциплины (исключите из пакета).",
};

export function getErrorMessageRu(code: string, fallback = "Ошибка обработки"): string {
  return ERROR_MESSAGE_RU[code] ?? fallback;
}
