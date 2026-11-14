import { Schema, model, type InferSchemaType } from "mongoose";
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    avatar: { type: String, default: null },
    // Buffer account id: this is how a person logs in now ("Continue with Buffer").
    bufferAccountId: { type: String, unique: true, sparse: true, index: true },
    // Left over from the old email/password login. Never used any more.
    passwordHash: { type: String, select: false },
  },
  { timestamps: true, versionKey: false },
);
export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
