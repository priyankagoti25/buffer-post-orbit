import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return next(new AppError(401, "UNAUTHENTICATED", "Missing access token."));
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET, {
      issuer: "buffer-oauth-app",
      audience: "buffer-oauth-client",
    }) as jwt.JwtPayload;
    if (!payload.sub) throw new Error("Missing subject");
    req.userId = String(payload.sub);
    next();
  } catch {
    next(
      new AppError(401, "UNAUTHENTICATED", "Invalid or expired access token."),
    );
  }
}
