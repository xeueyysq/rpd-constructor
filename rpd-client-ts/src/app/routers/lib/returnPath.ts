import { matchPath } from "react-router-dom";
import { RedirectPath } from "@shared/enums";

export function resolveReturnPath(
  from: unknown,
  availablePaths: readonly string[],
  homePath: string
): string {
  if (
    typeof from !== "string" ||
    !from.startsWith("/") ||
    from.startsWith("//") ||
    /[\\\s]/.test(from)
  )
    return homePath;

  const url = new URL(from, "https://app.internal");
  if (matchPath(RedirectPath.SIGN_IN, url.pathname)) return homePath;
  return availablePaths.some((path) =>
    matchPath({ path, end: true }, url.pathname)
  )
    ? from
    : homePath;
}
