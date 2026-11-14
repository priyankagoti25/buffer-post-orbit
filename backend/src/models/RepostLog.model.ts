import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One row for every repost made through this app.
 * Buffer does not track reposts, so we do: it gives "reposted 3 times" and blocks double clicks.
 */
const repostLogSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    sourcePostId: { type: String, required: true },
    newPostId: { type: String, required: true },
    channelId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
repostLogSchema.index({ userId: 1, sourcePostId: 1 });

export type RepostLogDoc = InferSchemaType<typeof repostLogSchema>;
export const RepostLog = model("RepostLog", repostLogSchema);
