import axios from "axios";
import { env } from "../config/env";
import { BufferConnection } from "../models/BufferConnection.model";
import { decrypt, encrypt } from "../utils/crypto";
import { AppError, BufferOAuthError } from "../utils/errors";
import { recordRateLimit } from "./rateLimit.service";

const AUTH_URL = "https://auth.buffer.com/auth";
const TOKEN_URL = "https://auth.buffer.com/token";
const API_URL = "https://api.buffer.com";

/** Refresh a bit early so we never send a token that expires mid-request. */
const EXPIRY_SKEW_MS = 60_000;
const REFRESH_LOCK_MS = 30_000;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The scopes we ask for. `offline_access` is always included: without it Buffer returns no refresh token,
 * and the user would be signed out of Buffer every hour no matter what is in .env.
 */
export function requestedScopes(): string {
  const list = env.BUFFER_SCOPES.split(/[\s,]+/).filter(Boolean);
  for (const must of ["offline_access", "account:read"])
    if (!list.includes(must)) list.push(must);
  return [...new Set(list)].join(" ");
}

// ---------------------------------------------------------------------------
// Step 2: build the URL the user is sent to
// ---------------------------------------------------------------------------
export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env.BUFFER_CLIENT_ID,
    redirect_uri: env.BUFFER_REDIRECT_URI,
    response_type: "code",
    scope: requestedScopes(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "consent",
  }).toString();
  return url.toString();
}

// ---------------------------------------------------------------------------
// Step 4 + refresh: talk to Buffer's token endpoint
// ---------------------------------------------------------------------------
async function postToken(
  params: Record<string, string>,
): Promise<TokenResponse> {
  try {
    const { data } = await axios.post<
      TokenResponse & { error?: string; error_description?: string }
    >(
      TOKEN_URL,
      new URLSearchParams({
        client_id: env.BUFFER_CLIENT_ID,
        client_secret: env.BUFFER_CLIENT_SECRET,
        ...params,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      },
    );
    if (!data.access_token)
      throw new BufferOAuthError(
        data.error ?? "token_request_failed",
        data.error_description ?? "Token endpoint returned no access token.",
        502,
      );
    return data;
  } catch (err) {
    if (err instanceof BufferOAuthError) throw err;
    const response = axios.isAxiosError(err) ? err.response : undefined;
    const body = response?.data as
      | { error?: string; error_description?: string }
      | undefined;
    throw new BufferOAuthError(
      body?.error ?? "token_request_failed",
      body?.error_description ??
        (err instanceof Error ? err.message : "Token endpoint request failed."),
      response?.status ?? 502,
    );
  }
}

export function exchangeCodeForTokens(code: string, codeVerifier: string) {
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.BUFFER_REDIRECT_URI,
    code_verifier: codeVerifier,
  });
}

function refreshTokens(refreshToken: string) {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

// ---------------------------------------------------------------------------
// Save tokens (encrypted)
// ---------------------------------------------------------------------------
export async function saveTokens(
  userId: string,
  tokens: TokenResponse,
  opts: { fresh?: boolean } = {},
) {
  const update: Record<string, unknown> = {
    accessTokenEnc: encrypt(tokens.access_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope ?? "",
    status: "active",
    refreshLockUntil: null,
  };
  // Refresh tokens are single-use: always store the newest one.
  if (tokens.refresh_token) {
    update.refreshTokenEnc = encrypt(tokens.refresh_token);
  } else if (opts.fresh) {
    // A brand-new sign-in replaces the old grant, so an old refresh token is useless. Never keep it.
    update.refreshTokenEnc = null;
    console.error(
      `Buffer returned NO refresh token for user ${userId} (granted scope: "${tokens.scope ?? ""}"). ` +
        "Check that offline_access is enabled for your app in Buffer's developer settings.",
    );
  }

  await BufferConnection.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true },
  );
}

// ---------------------------------------------------------------------------
// Get a token that is valid right now (refreshing if needed)
// ---------------------------------------------------------------------------
export async function getValidAccessToken(
  userId: string,
  opts: { forceRefresh?: boolean; attempt?: number } = {},
): Promise<string> {
  const conn = await BufferConnection.findOne({ userId });
  if (!conn)
    throw new AppError(404, "BUFFER_NOT_CONNECTED", "Buffer is not connected.");
  if (conn.status === "reauth_required") {
    throw new AppError(
      401,
      "BUFFER_REAUTH_REQUIRED",
      "Buffer access expired. Please reconnect.",
    );
  }

  const stillValid =
    conn.accessTokenExpiresAt.getTime() - Date.now() > EXPIRY_SKEW_MS;
  if (stillValid && !opts.forceRefresh) return decrypt(conn.accessTokenEnc);

  return refreshWithLock(
    userId,
    opts.attempt ?? 0,
    opts.forceRefresh ?? false,
    conn.accessTokenEnc,
  );
}

async function refreshWithLock(
  userId: string,
  attempt: number,
  force: boolean,
  tokenWeStartedWith: string,
): Promise<string> {
  // Try to take the lock. Only one request may refresh at a time, because the
  // refresh token is single-use: a second parallel refresh would revoke everything.
  const locked = await BufferConnection.findOneAndUpdate(
    {
      userId,
      $or: [
        { refreshLockUntil: null },
        { refreshLockUntil: { $lt: new Date() } },
      ],
    },
    { $set: { refreshLockUntil: new Date(Date.now() + REFRESH_LOCK_MS) } },
    { new: true },
  );

  if (!locked) {
    // Another request is refreshing right now. Wait, then re-read the fresh token.
    if (attempt >= 8)
      throw new AppError(
        503,
        "BUFFER_REFRESH_BUSY",
        "Token refresh is busy. Try again.",
      );
    await sleep(500);
    const latest = await BufferConnection.findOne({ userId });
    // If the other request already replaced the token, just use the new one.
    if (latest && latest.accessTokenEnc !== tokenWeStartedWith)
      return decrypt(latest.accessTokenEnc);
    return refreshWithLock(userId, attempt + 1, force, tokenWeStartedWith);
  }

  // We hold the lock. Someone may have refreshed just before we got it.
  if (
    locked.accessTokenEnc !== tokenWeStartedWith ||
    (!force &&
      locked.accessTokenExpiresAt.getTime() - Date.now() > EXPIRY_SKEW_MS)
  ) {
    await BufferConnection.updateOne(
      { userId },
      { $set: { refreshLockUntil: null } },
    );
    return decrypt(locked.accessTokenEnc);
  }

  if (!locked.refreshTokenEnc) {
    await markReauthRequired(userId);
    throw new AppError(
      401,
      "BUFFER_REAUTH_REQUIRED",
      "No refresh token. Please reconnect Buffer.",
    );
  }

  try {
    const tokens = await refreshTokens(decrypt(locked.refreshTokenEnc));
    await saveTokens(userId, tokens); // also clears the lock
    return tokens.access_token;
  } catch (err) {
    if (
      err instanceof BufferOAuthError &&
      ["invalid_grant", "invalid_client"].includes(err.oauthError)
    ) {
      await markReauthRequired(userId);
      throw new AppError(
        401,
        "BUFFER_REAUTH_REQUIRED",
        "Buffer access was revoked or expired. Please reconnect.",
      );
    }
    await BufferConnection.updateOne(
      { userId },
      { $set: { refreshLockUntil: null } },
    );
    throw err;
  }
}

async function markReauthRequired(userId: string) {
  await BufferConnection.updateOne(
    { userId },
    { $set: { status: "reauth_required", refreshLockUntil: null } },
  );
}

// ---------------------------------------------------------------------------
// Step 5: call the Buffer GraphQL API
// ---------------------------------------------------------------------------
export interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; path?: (string | number)[] }[];
}

async function rawGraphQL<T>(
  accessToken: string,
  query: string,
  variables?: object,
) {
  try {
    const response = await axios.post<GraphQLResponse<T>>(
      API_URL,
      { query, variables },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
        validateStatus: () => true,
      },
    );
    return {
      status: response.status,
      body: response.data ?? {},
      headers: response.headers as Record<string, unknown>,
    };
  } catch (err) {
    if (axios.isAxiosError(err))
      return {
        status: err.response?.status ?? 502,
        body: (err.response?.data ?? {}) as GraphQLResponse<T>,
        headers: (err.response?.headers ?? {}) as Record<string, unknown>,
      };
    throw err;
  }
}

/** One call to Buffer. Records the rate-limit headers and turns HTTP 429 into a clear error. */
async function callBuffer<T>(token: string, query: string, variables?: object) {
  const result = await rawGraphQL<T>(token, query, variables);
  recordRateLimit(result.headers);
  if (result.status === 429) {
    const wait = Number(result.headers["retry-after"] ?? 0);
    throw new AppError(
      429,
      "BUFFER_RATE_LIMITED",
      wait > 0
        ? `Buffer rate limit reached. Try again in about ${Math.ceil(wait / 60)} min.`
        : "Buffer rate limit reached. Try again in a few minutes.",
    );
  }
  return result;
}

/**
 * Like bufferGraphQL, but returns { data, errors } instead of throwing on GraphQL errors.
 * Use it when one request holds several operations and some may succeed while others fail
 * (for example creating a post on three channels at once).
 */
export async function bufferGraphQLPartial<T>(
  userId: string,
  query: string,
  variables?: object,
): Promise<GraphQLResponse<T> & { status: number }> {
  let token = await getValidAccessToken(userId);
  let result = await callBuffer<T>(token, query, variables);

  if (result.status === 401) {
    token = await getValidAccessToken(userId, { forceRefresh: true });
    result = await callBuffer<T>(token, query, variables);
    if (result.status === 401) {
      await markReauthRequired(userId);
      throw new AppError(
        401,
        "BUFFER_REAUTH_REQUIRED",
        "Buffer rejected the token. Please reconnect.",
      );
    }
  }
  return { ...result.body, status: result.status };
}

/**
 * Run any GraphQL query/mutation against the user's Buffer account.
 * Handles token refresh and one retry on 401. This is the function you reuse
 * for every future Buffer feature (channels, posts, ideas...).
 */
export async function bufferGraphQL<T>(
  userId: string,
  query: string,
  variables?: object,
): Promise<T> {
  // Token refresh, one retry on 401 and rate-limit handling all live in bufferGraphQLPartial.
  const result = await bufferGraphQLPartial<T>(userId, query, variables);

  if (result.errors?.length) {
    const msg = result.errors.map((e) => e.message).join("; ");
    throw new AppError(502, "BUFFER_API_ERROR", msg);
  }
  if (!result.data) {
    throw new AppError(
      502,
      "BUFFER_API_ERROR",
      `Buffer API returned HTTP ${result.status} with no data.`,
    );
  }
  return result.data;
}

/** Who owns this access token? Used once, at sign-in, before we have a user record. */
export async function fetchAccountWithToken(accessToken: string) {
  const result = await callBuffer<{
    account: {
      id: string;
      email: string | null;
      name: string | null;
      avatar: string | null;
    };
  }>(accessToken, `query WhoAmI { account { id email name avatar } }`);
  const account = result.body.data?.account;
  if (!account?.id) {
    throw new AppError(
      502,
      "BUFFER_API_ERROR",
      "Buffer did not return your account.",
    );
  }
  return account;
}
