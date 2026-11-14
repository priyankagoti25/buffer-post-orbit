import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * Ideas written in this app. We keep our own copy so they can be edited and deleted,
 * because Buffer's API can only CREATE ideas (no update, delete or list that we could confirm).
 */
const ideaSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: "", maxlength: 120, trim: true },
    // Plain text with Unicode styling, exactly what would be posted.
    text: { type: String, required: true, maxlength: 25000 },
    // The editor document, so formatting can be edited again later.
    contentJson: { type: Schema.Types.Mixed, default: null },
    // Media from Cloudinary (public https links), carried over when the idea becomes a post.
    assets: [
      new Schema(
        {
          kind: { type: String, enum: ["image", "video"] },
          url: String,
          altText: { type: String, default: null },
        },
        { _id: false },
      ),
    ],
    organizationId: { type: String, default: null },
    bufferIdeaId: { type: String, default: null },
    syncStatus: {
      type: String,
      enum: ["local", "synced", "failed"],
      default: "local",
    },
    syncError: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true, versionKey: false },
);

export type IdeaDoc = InferSchemaType<typeof ideaSchema>;
export const Idea = model("Idea", ideaSchema);
