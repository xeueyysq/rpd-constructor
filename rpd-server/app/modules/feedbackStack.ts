// Стек содержит только имена функций, имена файлов и координаты, без текста ошибки и полного пути.
export function cleanStack(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const frames = value.split("\n").slice(1, 9).map((line) => {
    const raw = line.trim().replace(/^at\s+/, "");
    const chrome = raw.match(/^([\w.$<>-]{1,100})\s+\((.+)\)$/);
    const firefox = raw.match(/^([\w.$<>-]{1,100})@(.+)$/);
    const name = chrome?.[1] ?? firefox?.[1];
    const location = chrome?.[2] ?? firefox?.[2] ?? raw;
    const match = location.match(/^(.*):(\d{1,7}):(\d{1,5})$/);
    if (!match) return undefined;
    const source = match[1].split(/[?#]/, 1)[0].replaceAll("\\", "/");
    const basename = source.slice(source.lastIndexOf("/") + 1);
    if (!/^[\w.-]{1,100}\.(?:[cm]?[jt]sx?)$/i.test(basename)) return undefined;
    return `${name ? `${name}@` : ""}${basename}:${match[2]}:${match[3]}`;
  }).filter((line): line is string => Boolean(line));
  return frames.length ? frames.join("\n").slice(0, 1200) : undefined;
}

export type SafeFeedbackFailure = { errorCode: string; stack?: string };

export function classifyFeedbackFailure(error: unknown): SafeFeedbackFailure | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { name?: unknown; code?: unknown; stack?: unknown };
  const name = typeof candidate.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(candidate.name)
    ? candidate.name : "ServerError";
  const code = typeof candidate.code === "string" && /^[A-Z0-9_]{2,20}$/.test(candidate.code)
    ? `:${candidate.code}` : "";
  return { errorCode: `${name}${code}`, stack: cleanStack(candidate.stack) };
}
