export function filenameFromContentDisposition(
  header: unknown,
  fallback: string
): string {
  if (typeof header !== "string") return fallback;

  const encoded = header.match(/(?:^|;)\s*filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      const filename = decodeURIComponent(encoded);
      if (filename && !/[\\/\p{Cc}\p{Cf}]/u.test(filename)) return filename;
    } catch {
      // A malformed extended filename may still have a usable ASCII fallback.
    }
  }

  const ascii = header.match(/(?:^|;)\s*filename\s*=\s*(?:"([^"]+)"|([^;]+))/i);
  const filename = (ascii?.[1] ?? ascii?.[2])?.trim();
  return filename && !/[\\/\p{Cc}\p{Cf}]/u.test(filename) ? filename : fallback;
}
