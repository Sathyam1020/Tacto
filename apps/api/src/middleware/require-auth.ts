import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

import { auth } from "../lib/auth.js";
import { AppError } from "./error.js";

/**
 * Session gate. Validates the better-auth session cookie and attaches
 * `req.user` / `req.session`. Express 5 forwards rejected promises to the
 * error middleware automatically.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    throw new AppError(401, "UNAUTHORIZED", "Sign in to continue");
  }

  req.user = session.user;
  req.session = session.session;
  next();
}
