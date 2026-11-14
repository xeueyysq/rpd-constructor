/**
 * Исключения для batch: файл не является типовой РПД.
 */

const RPD_MARKERS = [
  /рабочая\s+программа\s+дисциплины/i,
  /цели\s+(и\s+)?задачи|цел[иь]\s+освоения\s+дисциплины|цель\s+освоения\s+дисциплины/i,
  /место\s+дисциплины/i,
  /объ[её]м\s+дисциплины|трудо[её]мкость\s+дисциплины/i,
  /планируемые\s+результаты|формируемые\s+компетенции|индикаторы\s+достижения|код\s+компетенции/i,
  /содержание\s+дисциплины|тематический\s+план|структура\s+и\s+содержание/i,
  /ресурсное\s+обеспечение|перечень\s+литературы|учебно-методическое\s+и\s+информационное|материально-техническое\s+и\s+учебно-методическое/i,
] as const;

/** План 10: слишком мало типовых маркеров — вероятно не РПД. */
export function countRpdMarkers(plainText: string): number {
  const sample = plainText.replace(/^\uFEFF/, "").slice(0, 120_000);
  return RPD_MARKERS.filter((re) => re.test(sample)).length;
}

export function explainIfNonWorkProgramDocx(
  fileName: string,
  plainText: string,
): string | null {
  const lowerName = fileName.toLowerCase();
  const base = fileName.replace(/\.docx$/i, "").trim().toLowerCase();
  if (
    /json/.test(base) &&
    (/дисциплин/.test(lowerName) || /discipline/.test(lowerName))
  ) {
    return `Файл «${fileName}» не является рабочей программой дисциплины (по имени — JSON/дисциплина). Исключите его из пакетной приёмки.`;
  }

  const head = plainText.replace(/^\uFEFF/, "").slice(0, 6000).trim();
  if (
    head.startsWith("{") &&
    /"disciplins_name"\s*:/.test(head) &&
    /"(competencies|content|goals)"\s*:/.test(head)
  ) {
    return "Документ содержит JSON-текст внутри DOCX, а не типовую РПД. Исключите его из пакетной конвертации.";
  }

  const sample = plainText.replace(/^\uFEFF/, "").slice(0, 120_000);
  if (sample.length > 80 && countRpdMarkers(sample) < 2) {
    return "Документ почти не содержит типовых разделов рабочей программы дисциплины (цели, место, компетенции, содержание и т.д.). Возможно, это не РПД — исключите файл из пакета или проверьте полноту текста.";
  }

  return null;
}
