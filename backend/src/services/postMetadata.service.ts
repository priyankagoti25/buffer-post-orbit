import { z } from "zod";
import { idSchema } from "../utils/validate";

/** Networks this app can post to. Keys match the front end. */
export const SERVICE_KEYS = [
  "twitter",
  "linkedin",
  "facebook",
  "threads",
  "bluesky",
  "mastodon",
  "googlebusiness",
  "substack",
  "instagram",
  "pinterest",
  "tiktok",
  "youtube",
] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export const assetSchema = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string().url().startsWith("https://").max(1000),
  altText: z.string().trim().max(1000).optional(),
});
export type AssetIn = z.infer<typeof assetSchema>;
export const assetsSchema = z.array(assetSchema).max(10).default([]);

/** Extra settings a few networks need. All optional; only the ones that apply are used. */
export const optionsSchema = z
  .object({
    instagramType: z.enum(["post", "reel", "story"]).optional(),
    shareToFeed: z.boolean().optional(),
    facebookType: z.enum(["post", "reel", "story"]).optional(),
    // First comments are no longer offered. Older recurring posts may still carry one, so it is accepted and dropped.
    firstComment: z
      .string()
      .optional()
      .transform(() => undefined),
    title: z.string().trim().max(100).optional(),
    categoryId: z
      .string()
      .regex(/^\d{1,3}$/)
      .optional(),
    privacy: z.enum(["public", "unlisted", "private"]).optional(),
    madeForKids: z.boolean().optional(),
    boardServiceId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,100}$/)
      .optional(),
    pinUrl: z.string().url().max(500).optional(),
    schedulingType: z.enum(["automatic", "notification"]).optional(),
  })
  .strict()
  .default({});
export type TargetOptions = z.infer<typeof optionsSchema>;

export const targetSchema = z.object({
  channelId: idSchema,
  service: z.enum(SERVICE_KEYS),
  options: optionsSchema,
});
export type Target = z.infer<typeof targetSchema>;
export const targetsSchema = z
  .array(targetSchema)
  .min(1)
  .max(10)
  .refine(
    (t) => new Set(t.map((x) => x.channelId)).size === t.length,
    "Each channel can only be listed once.",
  );

/**
 * Hard limits we are sure about. X and Mastodon are left out on purpose: premium accounts and server settings
 * make their limits vary, so we let Buffer decide those.
 */
const TEXT_LIMIT: Partial<Record<ServiceKey, number>> = {
  linkedin: 3000,
  threads: 500,
  bluesky: 300,
  instagram: 2200,
  pinterest: 500,
  youtube: 5000,
};
const MAX_MEDIA: Partial<Record<ServiceKey, number>> = {
  twitter: 4,
  bluesky: 4,
  mastodon: 4,
  instagram: 10,
  pinterest: 1,
  youtube: 1,
  googlebusiness: 1,
};

/** Cheap checks that stop a request Buffer would refuse anyway, so no API call is wasted on it. */
function basicProblem(
  service: ServiceKey,
  assets: AssetIn[],
  text: string,
): string | null {
  if (!text.trim() && !assets.length)
    return "Write some text or add media first.";
  const limit =
    service === "tiktok"
      ? assets.some((a) => a.kind === "video")
        ? 2200
        : 4000
      : TEXT_LIMIT[service];
  if (limit && [...text].length > limit)
    return `Too long for ${service} (limit ${limit} characters).`;
  const max = MAX_MEDIA[service];
  if (max && assets.length > max)
    return `${service} allows up to ${max} media file${max === 1 ? "" : "s"}.`;
  return null;
}

const firstLine = (text: string) =>
  text
    .split("\n")
    .find((l) => l.trim())
    ?.trim() ?? "";

/**
 * Work out the network-specific settings Buffer needs for one channel, or say why it cannot be posted.
 * Field names come from Buffer's API reference (PostInputMetaData).
 */
export function prepareTarget(
  t: Target,
  assets: AssetIn[],
  text: string,
): { metadata?: Record<string, unknown>; error?: string } {
  const o = t.options;
  const hasVideo = assets.some((a) => a.kind === "video");
  const count = assets.length;

  const basic = basicProblem(t.service, assets, text);
  if (basic) return { error: basic };

  switch (t.service) {
    case "instagram": {
      if (!count) return { error: "Instagram needs an image or video." };
      const type =
        o.instagramType ??
        (hasVideo ? "reel" : count > 1 ? "carousel" : "post");
      return {
        metadata: {
          instagram: {
            type,
            shouldShareToFeed: o.shareToFeed ?? true,
          },
        },
      };
    }
    case "youtube": {
      if (!hasVideo) return { error: "YouTube needs a video." };
      const title = (o.title || firstLine(text)).slice(0, 100);
      if (!title) return { error: "YouTube needs a title." };
      return {
        metadata: {
          youtube: {
            title,
            categoryId: o.categoryId ?? "22",
            ...(o.privacy ? { privacy: o.privacy } : {}),
            ...(o.madeForKids !== undefined
              ? { madeForKids: o.madeForKids }
              : {}),
          },
        },
      };
    }
    case "pinterest": {
      if (!count) return { error: "Pinterest needs an image or video." };
      if (!o.boardServiceId) return { error: "Pinterest needs a board ID." };
      return {
        metadata: {
          pinterest: {
            boardServiceId: o.boardServiceId,
            ...(o.title ? { title: o.title } : {}),
            ...(o.pinUrl ? { url: o.pinUrl } : {}),
          },
        },
      };
    }
    case "tiktok":
      return !hasVideo && o.title
        ? { metadata: { tiktok: { title: o.title } } }
        : {};
    case "facebook":
      return {
        metadata: {
          facebook: { type: o.facebookType ?? "post" },
        },
      };
    case "googlebusiness":
      return { metadata: { google: { type: "whats_new" } } };
    case "linkedin":
      return {};
    default:
      return {};
  }
}
