import type { Request, Response } from "express";
import { env } from "../config/env";
import { BufferConnection } from "../models/BufferConnection.model";
import { OAuthState } from "../models/OAuthState.model";
import { User } from "../models/User.model";
import { createLoginCode } from "./auth.controller";
import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  fetchAccountWithToken,
  saveTokens,
} from "../services/buffer.service";
import { AppError, BufferOAuthError } from "../utils/errors";
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "../utils/pkce";

const toFrontend = (params: Record<string, string>) => {
  const url = new URL("/dashboard", env.CLIENT_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
};

/**
 * STEP A. Frontend calls this when the person clicks "Continue with Buffer" (no login needed).
 * We create the PKCE pair + state, remember them, and return the
 * Buffer URL. The frontend then navigates the browser to that URL.
 */
export async function connectBuffer(req: Request, res: Response) {
  if (
    !env.BUFFER_CLIENT_ID ||
    !env.BUFFER_CLIENT_SECRET ||
    !env.TOKEN_ENCRYPTION_KEY
  )
    throw new AppError(
      503,
      "BUFFER_NOT_CONFIGURED",
      "Buffer integration is not configured on the server.",
    );
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  await OAuthState.create({ state, codeVerifier });

  res.json({ url: buildAuthorizationUrl(state, codeChallenge) });
}

/**
 * STEP B. Buffer redirects the user's BROWSER here after they approve (or deny).
 * This is a normal browser navigation, so there is no Authorization header.
 * We check the `state` we stored in step A, then find or create the user from their Buffer account.
 */
export async function bufferCallback(req: Request, res: Response) {
  const { code, state, error } = req.query as Record<
    string,
    string | undefined
  >;

  if (!state) {
    res.redirect(toFrontend({ buffer: "error", reason: "invalid_request" }));
    return;
  }

  // One-time use: find AND delete, so a replayed callback fails.
  const saved = await OAuthState.findOneAndDelete({ state });
  if (!saved) {
    res.redirect(toFrontend({ buffer: "error", reason: "invalid_state" }));
    return;
  }

  if (error) {
    const reason = error === "access_denied" ? "access_denied" : "oauth_error";
    res.redirect(toFrontend({ buffer: "error", reason }));
    return;
  }

  if (!code) {
    res.redirect(toFrontend({ buffer: "error", reason: "invalid_request" }));
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code, saved.codeVerifier);
    const account = await fetchAccountWithToken(tokens.access_token);
    const email = (account.email ?? "").trim().toLowerCase();
    if (!email)
      throw new AppError(
        502,
        "BUFFER_API_ERROR",
        "Buffer did not return an email address.",
      );
    // Find by Buffer id first, then by email (so people from the old email login keep their data).
    let user = await User.findOne({ bufferAccountId: account.id });
    if (!user) user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: account.name || email.split("@")[0],
        email,
        avatar: account.avatar,
        bufferAccountId: account.id,
      });
    } else {
      user.bufferAccountId = account.id;
      user.avatar = account.avatar ?? user.avatar;
      if (account.name) user.name = account.name;
      await user.save();
    }
    await saveTokens(String(user._id), tokens, { fresh: true });
    res.redirect(
      toFrontend({
        buffer: "connected",
        code: await createLoginCode(String(user._id)),
      }),
    );
  } catch (err) {
    console.error(
      "Buffer token exchange failed:",
      err instanceof Error ? err.message : err,
    );
    const reason =
      err instanceof BufferOAuthError && err.oauthError === "invalid_grant"
        ? "code_expired"
        : "token_exchange_failed";
    res.redirect(toFrontend({ buffer: "error", reason }));
  }
}

/** Is this user connected? Never returns tokens. */
export async function bufferStatus(req: Request, res: Response) {
  const conn = await BufferConnection.findOne({ userId: req.userId! });
  res.json({
    connected:
      !!conn &&
      conn.status === "active" &&
      (!!conn.refreshTokenEnc ||
        conn.accessTokenExpiresAt.getTime() > Date.now()),
    // Also true when the access token ran out and there is no refresh token to renew it with.
    reauthRequired:
      conn?.status === "reauth_required" ||
      (!!conn &&
        !conn.refreshTokenEnc &&
        conn.accessTokenExpiresAt.getTime() < Date.now()),
    canRefresh: !!conn?.refreshTokenEnc,
    scope: conn?.scope ?? null,
    connectedAt: conn?.createdAt ?? null,
  });
}

/**
 * Remove the stored tokens from YOUR database.
 * (Buffer's docs do not describe a revoke endpoint; users can also revoke your app
 * from their Buffer settings at any time.)
 */
export async function disconnectBuffer(req: Request, res: Response) {
  const result = await BufferConnection.deleteOne({ userId: req.userId! });
  if (result.deletedCount === 0)
    throw new AppError(404, "BUFFER_NOT_CONNECTED", "Buffer is not connected.");
  res.status(204).end();
}
