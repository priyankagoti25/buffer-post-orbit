import type { Request, Response } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User.model";
import { z } from "zod";
import { LoginCode } from "../models/LoginCode.model";
import { RefreshToken } from "../models/RefreshToken.model";
import { AppError } from "../utils/errors";
import { parse } from "../utils/validate";

const REFRESH_COOKIE = "refreshToken";
const refreshHash = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  // A frontend and an API on different sites (the usual live setup) need "none". "none" requires https.
  sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
function issueAccessToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: "15m",
    issuer: "buffer-oauth-app",
    audience: "buffer-oauth-client",
  });
}
/** Called by the Buffer callback: make a short-lived, single-use code for the browser. */
export async function createLoginCode(userId: string): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  await LoginCode.create({
    codeHash: refreshHash(code),
    userId,
    expiresAt: new Date(Date.now() + 2 * 60_000),
  });
  return code;
}

/**
 * The page sends the code from the redirect URL. We set the session cookie in THIS response
 * (a normal API call from the page), the same way a password login would.
 */
export async function exchangeCode(req: Request, res: Response) {
  const { code } = parse(
    z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{32,100}$/) }),
    req.body,
  );
  const found = await LoginCode.findOneAndDelete({
    codeHash: refreshHash(code),
    expiresAt: { $gt: new Date() },
  });
  if (!found)
    throw new AppError(
      401,
      "INVALID_LOGIN_CODE",
      "This sign-in link expired. Please try again.",
    );
  const user = await User.findById(found.userId);
  if (!user)
    throw new AppError(
      401,
      "INVALID_LOGIN_CODE",
      "This sign-in link expired. Please try again.",
    );
  await issueRefreshToken(String(user._id), res);
  res.json({
    user: publicUser(user),
    accessToken: issueAccessToken(String(user._id)),
  });
}

export async function issueRefreshToken(userId: string, res: Response) {
  const token = crypto.randomBytes(48).toString("base64url");
  await RefreshToken.create({
    userId,
    tokenHash: refreshHash(token),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
}
function publicUser(user: any) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? null,
  };
}

/** Called by the page on load. If the browser holds a valid refresh cookie, the person is signed in. */
export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== "string" || token.length < 40)
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Please log in again.");
  const old = await RefreshToken.findOneAndUpdate(
    {
      tokenHash: refreshHash(token),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } },
    { new: false },
  );
  if (!old) {
    // A token used a few seconds ago is usually a second tab or a retry. Keep the new cookie it was given.
    const justUsed = await RefreshToken.exists({
      tokenHash: refreshHash(token),
      revokedAt: { $gt: new Date(Date.now() - 15_000) },
    });
    if (justUsed)
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Please try again.");
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Please log in again.");
  }
  const user = await User.findById(old.userId);
  if (!user)
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Please log in again.");
  await issueRefreshToken(String(old.userId), res);
  res.json({
    user: publicUser(user),
    accessToken: issueAccessToken(String(user._id)),
  });
}
export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (typeof token === "string")
    await RefreshToken.updateOne(
      { tokenHash: refreshHash(token), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}
