import { Schema, model, InferSchemaType } from "mongoose";

/**
 * One document per user of YOUR website who connected a Buffer account.
 * Tokens are stored ENCRYPTED (see utils/crypto.ts). Never store them in plain text.
 */
const bufferConnectionSchema = new Schema(
  {
    // The id of the user in YOUR system (the JWT "sub"). One Buffer connection per user.
    userId: { type: String, required: true, unique: true, index: true },

    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: { type: String, default: null },
    accessTokenExpiresAt: { type: Date, required: true },
    scope: { type: String, default: "" },

    // 'reauth_required' = refresh failed or access was revoked. User must connect again.
    status: {
      type: String,
      enum: ["active", "reauth_required"],
      default: "active",
    },

    // Simple lock so two requests never use the same single-use refresh token at once.
    refreshLockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export type BufferConnectionDoc = InferSchemaType<
  typeof bufferConnectionSchema
>;
export const BufferConnection = model(
  "BufferConnection",
  bufferConnectionSchema,
);
