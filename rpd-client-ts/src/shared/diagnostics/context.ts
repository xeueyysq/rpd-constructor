export type Breadcrumb = {
  at: string;
  kind: "http" | "navigation" | "action" | "error";
  operation?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
  requestBytes?: number;
};

export type DiagnosticContext = {
  clientRelease?: string;
  route?: string;
  primaryRole?: string;
  activeRole?: string;
  complectId?: number;
  templateId?: number;
  section?: string;
  faculty?: string;
  direction?: string;
  profile?: string;
  form?: string;
  year?: string;
  discipline?: string;
  browser?: string;
  breadcrumbs?: Breadcrumb[];
};

export type EntityContext = Pick<
  DiagnosticContext,
  | "complectId"
  | "templateId"
  | "section"
  | "faculty"
  | "direction"
  | "profile"
  | "form"
  | "year"
  | "discipline"
>;

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const operation = /^[a-z][a-z0-9._:-]{0,79}$/i;

export function safeUuid(value: unknown): string | undefined {
  return typeof value === "string" && uuid.test(value)
    ? value.toLowerCase()
    : undefined;
}

export function safeOperation(value: unknown): string | undefined {
  return typeof value === "string" && operation.test(value) ? value : undefined;
}

export function pathOnly(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return undefined;
  const path = value.split(/[?#]/, 1)[0];
  return path.length <= 300 &&
    !Array.from(path).some((char) => char === "\\" || char.charCodeAt(0) < 32)
    ? path
    : undefined;
}

function label(value: unknown, max = 160): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = Array.from(String(value).slice(0, max), (char) =>
    char.charCodeAt(0) < 32 ? " " : char
  ).join("");
  return text || undefined;
}

function id(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 2_147_483_647
    ? value
    : undefined;
}

export function safeEntityContext(value: EntityContext): EntityContext {
  return {
    complectId: id(value.complectId),
    templateId: id(value.templateId),
    section: label(value.section),
    faculty: label(value.faculty),
    direction: label(value.direction),
    profile: label(value.profile),
    form: label(value.form),
    year: label(value.year),
    discipline: label(value.discipline),
  };
}

export function safeBrowserSummary(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  const agent = navigator.userAgent;
  const browser =
    agent.match(/(?:Firefox|Edg|Chrome|Safari)\/([\d.]+)/)?.[0] ?? "browser";
  const platform =
    /Macintosh|Windows|Linux|Android|iPhone|iPad/.exec(agent)?.[0] ?? "unknown";
  return `${browser} ${platform}`;
}

export function boundedContext(value: DiagnosticContext): DiagnosticContext {
  const breadcrumbs = value.breadcrumbs?.slice(-30).flatMap((crumb) => {
    if (
      !crumb ||
      !["http", "navigation", "action", "error"].includes(crumb.kind) ||
      Number.isNaN(Date.parse(crumb.at))
    )
      return [];
    const bounded = (number: unknown, max: number) =>
      typeof number === "number" &&
      Number.isSafeInteger(number) &&
      number >= 0 &&
      number <= max
        ? number
        : undefined;
    return [
      {
        at: new Date(crumb.at).toISOString(),
        kind: crumb.kind,
        operation: safeOperation(crumb.operation),
        method: ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(
          crumb.method ?? ""
        )
          ? crumb.method
          : undefined,
        route: pathOnly(crumb.route),
        status: bounded(crumb.status, 599),
        durationMs: bounded(crumb.durationMs, 3_600_000),
        requestId: safeUuid(crumb.requestId),
        requestBytes: bounded(crumb.requestBytes, 3_145_728),
      } satisfies Breadcrumb,
    ];
  });
  const context: DiagnosticContext = {
    clientRelease: label(value.clientRelease),
    route: pathOnly(value.route),
    primaryRole: label(value.primaryRole),
    activeRole: label(value.activeRole),
    ...safeEntityContext(value),
    browser: label(value.browser, 120),
    breadcrumbs,
  };
  while (
    context.breadcrumbs?.length &&
    new TextEncoder().encode(JSON.stringify(context)).length > 24 * 1024
  )
    context.breadcrumbs.shift();
  return context;
}

// Передаём только безопасную форму JS-стека: без текста исключения, URL и путей.
export function safeStack(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const frames = value
    .split("\n")
    .slice(1, 9)
    .flatMap((line) => {
      const match = line
        .trim()
        .match(
          /^(?:at\s+)?(?:([\w.$<>-]{1,100})\s+\()?([^\s()]+\.[cm]?[jt]sx?):(\d{1,7}):(\d{1,5})\)?$/
        );
      if (!match) return [];
      const filename = match[2]
        .split(/[?#]/, 1)[0]
        .replaceAll("\\", "/")
        .split("/")
        .at(-1);
      return filename && /^[\w.-]{1,100}\.[cm]?[jt]sx?$/.test(filename)
        ? [
            `    at ${match[1] ?? "anonymous"} (${filename}:${match[3]}:${match[4]})`,
          ]
        : [];
    });
  return frames.length
    ? `Error\n${frames.join("\n")}`.slice(0, 1200)
    : undefined;
}
