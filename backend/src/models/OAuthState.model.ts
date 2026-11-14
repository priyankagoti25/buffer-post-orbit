import { Schema, model } from "mongoose";

/**
 * Short-lived record created when a user clicks "Connect Buffer".
 * It ties the random `state` value (and the PKCE verifier) to the user who started the flow.
 * MongoDB deletes it automatically after 10 minutes (TTL index).
 */
const oauthStateSchema = new Schema({
  state: { type: String, required: true, unique: true },
  userId: { type: String, default: null },
  codeVerifier: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

export const OAuthState = model("OAuthState", oauthStateSchema);
