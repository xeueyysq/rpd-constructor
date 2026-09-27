import type { Response } from "express";

class WebError {
  status: number;
  error: unknown;
  constructor(status: number, error?: unknown) {
    this.status = status;
    this.error = error;
  }
}

class Unprocessable extends WebError {
  constructor(error?: unknown) {
    super(422, error);
  }
}

class Conflict extends WebError {
  constructor(error?: unknown) {
    super(409, error);
  }
}

class NotFound extends WebError {
  constructor(error?: unknown) {
    console.log(error);
    super(404, error);
  }
}

class Forbidden extends WebError {
  constructor(error?: unknown) {
    super(403, error);
  }
}

class Unauthorized extends WebError {
  constructor(error?: unknown) {
    super(401, error);
  }
}

function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error ? error.message as string : String(error);
}

function errorStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  return undefined;
}

class ErrorUtils {
  static catchError(res: Response, error: unknown) {
    console.log(error);
    const status = error && typeof error === "object"
      ? "status" in error && typeof error.status === "number" ? error.status
        : "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined
      : undefined;
    return res.status(status || 500).json(error);
  }
}

export {
  ErrorUtils,
  errorMessage,
  errorStatusCode,
  NotFound, 
  Forbidden, 
  Conflict, 
  Unauthorized, 
  Unprocessable
};
