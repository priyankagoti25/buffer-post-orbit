import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Origin validation is defense in depth for cookie-authenticated state changes. */
export function requireTrustedOrigin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!unsafeMethods.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || origin !== env.CLIENT_URL) {
    return next(
      new AppError(403, "UNTRUSTED_ORIGIN", "Request origin is not allowed."),
    );
  }
  next();
}
