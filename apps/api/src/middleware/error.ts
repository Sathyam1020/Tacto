import type { NextFunction, Request, Response } from "express";
import { ZodError, z } from "zod";

import { env } from "../env.js";

/**
 * Typed operational error. Throw from anywhere; the error middleware turns
 * it into a structured JSON response. Anything else becomes a 500.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Central error handler — must be registered last. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express identifies error middleware by arity — the 4th param is required.
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: z.treeifyError(err),
      },
    });
    return;
  }

  // Unexpected error: log it, return an opaque 500 (no internals leak).
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "Something went wrong"
          : err instanceof Error
            ? err.message
            : String(err),
    },
  });
}
