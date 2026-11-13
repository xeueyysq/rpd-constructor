type DocumentMetadata = {
  disciplins_name: string | null;
  direction: string | null;
  year: number | null;
};

const MAX_FILENAME_BYTES = 180;

function truncateUtf8(value: string, maxBytes: number): string {
  let result = "";
  let size = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (size + characterBytes > maxBytes) break;
    result += character;
    size += characterBytes;
  }
  return result.trim().replace(/[. _]+$/u, "");
}

function filenamePart(value: string | null, fallback: string, maxBytes: number): string {
  const clean = (value ?? "")
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]+/gu, " ")
    .replace(/\s+/gu, " ")
    .replace(/^[. _]+|[. _]+$/gu, "");
  return truncateUtf8(clean, maxBytes) || fallback;
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function documentContentDisposition(metadata: DocumentMetadata, extension: "pdf" | "docx"): string {
  const year = metadata.year !== null && Number.isInteger(metadata.year)
    ? String(metadata.year) : "год";
  const suffix = `_${year}.${extension}`;
  const partBudget = Math.floor((MAX_FILENAME_BYTES - Buffer.byteLength(suffix, "utf8") - 1) / 2);
  const discipline = filenamePart(metadata.disciplins_name, "Дисциплина", partBudget);
  const direction = filenamePart(metadata.direction, "Направление", partBudget);
  const filename = `${discipline}_${direction}${suffix}`;
  const asciiFallback = `rpd_${year}.${extension}`;
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}
