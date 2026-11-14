import { createHash, randomBytes } from "crypto";

/** Random secret kept on the server until the code exchange. 43 chars, base64url. */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** BASE64URL(SHA256(verifier)). Sent to Buffer on the authorization request. */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Random value used to stop CSRF and to find the matching verifier on callback. */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}
