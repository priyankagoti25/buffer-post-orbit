import type { Request, Response } from "express";
import { z } from "zod";
import { RepostLog } from "../models/RepostLog.model";
import {
  createPosts,
  deletePost,
  editPost,
  getPost,
  listPosts,
} from "../services/bufferData.service";
import {
  assetsSchema,
  targetsSchema,
  type AssetIn,
} from "../services/postMetadata.service";
import { RecurringSeries } from "../models/RecurringSeries.model";
import { apiCache, clearUserCache } from "../utils/cache";
import { AppError } from "../utils/errors";
import { cleanText, idSchema, parse } from "../utils/validate";

const modeSchema = z.enum([
  "addToQueue",
  "shareNext",
  "shareNow",
  "customScheduled",
]);
const textSchema = z
  .string()
  .max(25000)
  .transform(cleanText)
  .refine((t) => t.trim().length > 0, "Write something first.");

/** A custom time is required (and must be in the future) when mode is customScheduled. */
const withSchedule = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({
      ...shape,
      mode: modeSchema.default("addToQueue"),
      dueAt: z.string().datetime().optional(),
      saveToDraft: z.boolean().default(false),
    })
    .superRefine((v, ctx) => {
      if (v.saveToDraft || v.mode !== "customScheduled") return;
      if (!v.dueAt)
        ctx.addIssue({
          code: "custom",
          path: ["dueAt"],
          message: "Pick a date and time.",
        });
      else if (Date.parse(v.dueAt) < Date.now() + 30_000)
        ctx.addIssue({
          code: "custom",
          path: ["dueAt"],
          message: "Pick a time in the future.",
        });
    });

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------
const listQuery = z.object({
  organizationId: idSchema,
  channelId: idSchema.optional(),
  bucket: z
    .enum([
      "queue",
      "scheduled",
      "draft",
      "overdue",
      "approval",
      "sent",
      "failed",
      "other",
      "all",
    ])
    .default("all"),
  after: z.string().max(300).optional(),
  first: z.coerce.number().int().min(1).max(100).default(50),
  refresh: z.string().optional(),
});

export async function listPostsHandler(req: Request, res: Response) {
  const userId = req.userId!;
  const q = parse(listQuery, req.query);
  const key = `${userId}:posts:${q.organizationId}:${q.channelId ?? "-"}:${q.bucket}:${q.after ?? "-"}:${q.first}`;
  let result =
    q.refresh === "1"
      ? undefined
      : apiCache.get<Awaited<ReturnType<typeof listPosts>>>(key);
  if (!result) {
    result = await listPosts(userId, q);
    apiCache.set(key, result);
  }

  // Attach "reposted N times" to every post we show.
  const ids = result.posts.map((p) => p.id);
  const stats = ids.length
    ? await RepostLog.aggregate<{ _id: string; count: number; last: Date }>([
        { $match: { userId, sourcePostId: { $in: ids } } },
        {
          $group: {
            _id: "$sourcePostId",
            count: { $sum: 1 },
            last: { $max: "$createdAt" },
          },
        },
      ])
    : [];
  const byId = new Map(stats.map((s) => [s._id, s]));

  // Mark posts that were made by one of the user's recurring posts.
  const recurringIds = new Set<string>();
  if (ids.length) {
    const made = await RecurringSeries.find({
      userId,
      "occurrences.posts.postId": { $in: ids },
    })
      .select("occurrences.posts.postId")
      .lean();
    for (const s of made)
      for (const o of s.occurrences ?? [])
        for (const p of o.posts ?? []) if (p.postId) recurringIds.add(p.postId);
  }
  res.json({
    ...result,
    posts: result.posts.map((p) => ({
      ...p,
      repostCount: byId.get(p.id)?.count ?? 0,
      recurring: recurringIds.has(p.id),
      lastRepostedAt: byId.get(p.id)?.last ?? null,
    })),
  });
}

export async function getPostHandler(req: Request, res: Response) {
  const { id } = parse(z.object({ id: idSchema }), req.params);
  res.json({ post: await getPost(req.userId!, id) });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
const createBody = withSchedule({
  targets: targetsSchema,
  text: textSchema,
  assets: assetsSchema,
});

export async function createPostsHandler(req: Request, res: Response) {
  const userId = req.userId!;
  const body = parse(createBody, req.body);
  const results = await createPosts(userId, body);
  clearUserCache(userId);
  res.status(results.some((r) => r.ok) ? 201 : 422).json({ results });
}

// ---------------------------------------------------------------------------
// Edit, schedule a draft, delete
// ---------------------------------------------------------------------------
const editBody = z
  .object({
    text: textSchema.optional(),
    mode: modeSchema.optional(),
    dueAt: z.string().datetime().optional(),
    saveToDraft: z.boolean().optional(),
    approvalChange: z.enum(["request", "revert"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to change.")
  .refine(
    (v) => v.mode !== "customScheduled" || v.dueAt,
    "Pick a date and time.",
  );

export async function editPostHandler(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(z.object({ id: idSchema }), req.params);
  const body = parse(editBody, req.body);
  const post = await editPost(userId, id, body);
  clearUserCache(userId);
  res.json({ post });
}

/** Turn a draft into a scheduled post: add to queue, or pick a time. */
const scheduleBody = withSchedule({}).refine(
  (v) => !v.saveToDraft,
  "Use the edit endpoint to keep a draft.",
);

export async function schedulePostHandler(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(z.object({ id: idSchema }), req.params);
  const body = parse(scheduleBody, req.body);
  // Buffer checks that the post still has text or media when it leaves the draft state, and it can
  // read an omitted field as empty. So we send the draft's own text and media back with the change.
  const current = await getPost(userId, id);
  const assets: AssetIn[] = current.assets
    .filter((a) => a.source)
    .map((a) => ({
      kind: /^video\//i.test(a.mimeType ?? "")
        ? ("video" as const)
        : ("image" as const),
      url: a.source as string,
    }));
  const post = await editPost(userId, id, {
    mode: body.mode,
    dueAt: body.dueAt,
    saveToDraft: false,
    ...(current.text ? { text: current.text } : {}),
    ...(assets.length ? { assets } : {}),
  });
  clearUserCache(userId);
  res.json({ post });
}

export async function deletePostHandler(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(z.object({ id: idSchema }), req.params);
  await deletePost(userId, id);
  clearUserCache(userId);
  res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Repost: create a new post from an old one
// ---------------------------------------------------------------------------
const repostBody = withSchedule({
  targets: targetsSchema,
  text: textSchema,
  assets: assetsSchema,
});

export async function repostHandler(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(z.object({ id: idSchema }), req.params);
  const body = parse(repostBody, req.body);
  const channelIds = body.targets.map((t) => t.channelId);

  // Buffer has no idempotency key, so stop a double click from posting twice.
  const recent = await RepostLog.findOne({
    userId,
    sourcePostId: id,
    channelId: { $in: channelIds },
    createdAt: { $gt: new Date(Date.now() - 30_000) },
  }).lean();
  if (recent)
    throw new AppError(
      409,
      "DUPLICATE_REPOST",
      "You just reposted this. Wait a moment before trying again.",
    );

  const results = await createPosts(userId, body);

  const saved = results.filter((r) => r.ok && r.post?.id);
  if (saved.length) {
    await RepostLog.insertMany(
      saved.map((r) => ({
        userId,
        sourcePostId: id,
        newPostId: r.post!.id as string,
        channelId: r.channelId,
      })),
    );
  }
  clearUserCache(userId);
  res
    .status(saved.length ? 201 : 422)
    .json({ results, mediaReused: body.assets.length });
}
