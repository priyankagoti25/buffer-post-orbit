import { Schema, model, type InferSchemaType } from "mongoose";

const occurrenceSchema = new Schema(
  {
    index: { type: Number, required: true },
    dueAt: { type: Date, required: true },
    // created = every channel accepted it, partial = some did, skipped = the time had already passed
    state: {
      type: String,
      enum: ["created", "partial", "skipped"],
      required: true,
    },
    posts: [
      new Schema(
        {
          channelId: String,
          postId: { type: String, default: null },
          error: { type: String, default: null },
        },
        { _id: false },
      ),
    ],
  },
  { _id: false },
);

const seriesSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, default: "", maxlength: 80 },
    text: { type: String, required: true },
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
    targets: [
      new Schema(
        {
          channelId: String,
          service: String,
          options: { type: Schema.Types.Mixed, default: {} },
        },
        { _id: false },
      ),
    ],
    rule: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        required: true,
      },
      interval: { type: Number, required: true },
      weekdays: [Number],
      time: { type: String, required: true },
      timezone: { type: String, required: true },
    },
    startDate: { type: String, required: true }, // local date of the first occurrence, YYYY-MM-DD
    endDate: { type: String, default: null },
    maxOccurrences: { type: Number, default: null },
    status: {
      type: String,
      enum: ["active", "paused", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    nextIndex: { type: Number, default: 0 }, // next occurrence number that has not been created yet
    occurrences: [occurrenceSchema],
    // Times Buffer refused as "same post twice". Kept so the person can see why a day is missing.
    skippedDuplicates: [
      new Schema({ dueAt: Date, message: String }, { _id: false }),
    ],
    nextCheckAt: { type: Date, default: null, index: true },
    syncLockUntil: { type: Date, default: null },
    failures: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    sourcePostId: { type: String, default: null },
  },
  { timestamps: true },
);

export type RecurringSeriesDoc = InferSchemaType<typeof seriesSchema>;
export const RecurringSeries = model("RecurringSeries", seriesSchema);
