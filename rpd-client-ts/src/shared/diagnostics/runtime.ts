import {
  boundedContext,
  pathOnly,
  safeBrowserSummary,
  safeEntityContext,
  safeOperation,
  safeStack,
  safeUuid,
  type Breadcrumb,
  type DiagnosticContext,
  type EntityContext,
} from "./context";
import { version as clientRelease } from "../../../package.json";

export type FrozenDiagnostics = {
  generation: number;
  context: DiagnosticContext;
};
export type DiagnosticEvent = {
  clientEventId: string;
  operation: string;
  errorCode: string;
  status?: number;
  requestId?: string;
  stack?: string;
  context: DiagnosticContext;
};
type Sender = (event: DiagnosticEvent) => Promise<unknown>;

let generation = 0;
let enabled = false;
let route: string | undefined;
let primaryRole: string | undefined;
let activeRole: string | undefined;
let entity: EntityContext = {};
let breadcrumbs: Breadcrumb[] = [];
let sender: Sender | undefined;
let queue: DiagnosticEvent[] = [];
let sending = false;
let minute = 0;
let sentThisMinute = 0;
const availabilityListeners = new Set<() => void>();
const handledErrors = new WeakSet<object>();

export function resetDiagnostics(nextGeneration: number): void {
  generation = nextGeneration;
  enabled = false;
  route = undefined;
  primaryRole = undefined;
  activeRole = undefined;
  entity = {};
  breadcrumbs = [];
  queue = [];
  sender = undefined;
  sending = false;
  minute = 0;
  sentThisMinute = 0;
  availabilityListeners.forEach((listener) => listener());
}

export function getDiagnosticsGeneration(): number {
  return generation;
}
export function getFeedbackAvailable(): boolean {
  return enabled;
}
export function subscribeFeedbackAvailability(
  listener: () => void
): () => void {
  availabilityListeners.add(listener);
  return () => {
    availabilityListeners.delete(listener);
  };
}
export function setFeedbackAvailable(
  value: boolean,
  expectedGeneration: number
): void {
  if (generation !== expectedGeneration || enabled === value) return;
  enabled = value;
  if (!enabled) queue = [];
  availabilityListeners.forEach((listener) => listener());
}
export function setDiagnosticSender(value: Sender | undefined): void {
  sender = value;
  void drain();
}

export function setDiagnosticRoles(
  primary: string,
  active: string,
  expectedGeneration: number
): void {
  if (generation !== expectedGeneration) return;
  primaryRole = primary;
  activeRole = active;
}
export function setDiagnosticRoute(
  value: string,
  expectedGeneration: number
): void {
  if (generation !== expectedGeneration) return;
  const next = pathOnly(value);
  if (route === next) return;
  route = next;
  entity = {};
  addBreadcrumb({
    at: new Date().toISOString(),
    kind: "navigation",
    route: next,
  });
}
export function setDiagnosticEntity(
  value: EntityContext,
  expectedRoute: string,
  expectedGeneration: number
): void {
  if (generation !== expectedGeneration || route !== pathOnly(expectedRoute))
    return;
  entity = safeEntityContext(value);
}
export function addBreadcrumb(
  value: Breadcrumb,
  expectedGeneration = generation
): void {
  if (expectedGeneration !== generation) return;
  breadcrumbs.push(value);
  if (breadcrumbs.length > 30) breadcrumbs = breadcrumbs.slice(-30);
}
export function freezeDiagnosticContext(): FrozenDiagnostics {
  return {
    generation,
    context: boundedContext({
      clientRelease,
      route,
      primaryRole,
      activeRole,
      ...entity,
      browser: safeBrowserSummary(),
      breadcrumbs,
    }),
  };
}

async function drain(): Promise<void> {
  if (sending || !sender || !enabled) return;
  sending = true;
  const current = generation;
  try {
    while (queue.length && current === generation && enabled && sender) {
      const event = queue.shift()!;
      try {
        await sender(event);
      } catch {
        /* Диагностика не меняет работу приложения. */
      }
    }
  } finally {
    if (current === generation) sending = false;
  }
}

function queueEvent(event: DiagnosticEvent, expectedGeneration: number): void {
  if (expectedGeneration !== generation || !enabled || !sender) return;
  const now = Date.now();
  if (now - minute >= 60_000) {
    minute = now;
    sentThisMinute = 0;
  }
  if (sentThisMinute >= 8 || queue.length >= 8) return;
  sentThisMinute++;
  queue.push(event);
  void drain();
}

export function markHandledError(error: unknown): void {
  if (typeof error === "object" && error !== null) handledErrors.add(error);
}

export function captureRuntimeError(
  error: unknown,
  operation = "runtime.js",
  frozen = freezeDiagnosticContext()
): void {
  if (
    frozen.generation !== generation ||
    !enabled ||
    (typeof error === "object" && error !== null && handledErrors.has(error))
  )
    return;
  const name = error instanceof Error ? error.name : "Error";
  if (["SessionChangedError", "AbortError"].includes(name)) return;
  const errorCode = safeOperation(name) ?? "Error";
  const stableOperation = safeOperation(operation) ?? "runtime.js";
  const stack = error instanceof Error ? safeStack(error.stack) : undefined;
  addBreadcrumb(
    { at: new Date().toISOString(), kind: "error", operation: stableOperation },
    frozen.generation
  );
  queueEvent(
    {
      clientEventId: crypto.randomUUID(),
      operation: stableOperation,
      errorCode,
      stack,
      context: boundedContext(frozen.context),
    },
    frozen.generation
  );
}

export function captureHttpFailure(args: {
  frozen: FrozenDiagnostics;
  operation: string;
  status?: number;
  requestId?: string;
  errorCode: string;
  stack?: string;
}): void {
  const { frozen } = args;
  if (frozen.generation !== generation) return;
  queueEvent(
    {
      clientEventId: crypto.randomUUID(),
      operation: args.operation,
      errorCode: args.errorCode,
      status: args.status,
      requestId: safeUuid(args.requestId),
      stack: safeStack(args.stack),
      context: boundedContext(frozen.context),
    },
    frozen.generation
  );
}

export function isDiagnosticPath(value: unknown): boolean {
  const path = pathOnly(value);
  return Boolean(
    path && /^\/(?:api\/)?(?:feedback|diagnostics)(?:\/|$)/.test(path)
  );
}
