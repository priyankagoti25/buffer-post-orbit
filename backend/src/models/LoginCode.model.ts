import { Schema, model } from "mongoose";

/** One-time code handed to the browser after Buffer sign-in. The page swaps it for a session. */
const loginCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true, versionKey: false },
);
export const LoginCode = model("LoginCode", loginCodeSchema);
