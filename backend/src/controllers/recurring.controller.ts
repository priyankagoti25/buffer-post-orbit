import type { Request, Response } from "express";
import { z } from "zod";
import { RecurringSeries } from "../models/RecurringSeries.model";
import {
  prepareTarget,
  assetsSchema,
  targetsSchema,
} from "../services/postMetadata.service";
import { ruleProblem, isValidTimeZone } from "../services/recurrence";
import {
  publicSeries,
  reconcileUser,
  removeUpcoming,
  syncDueForUser,
  syncSeries,
} from "../services/recurring.service";
import { purgeGoneChannels } from "../services/channelCleanup.service";
import { apiCache, clearUserCache } from "../utils/cache";
import { AppError } from "../utils/errors";
import { cleanText, mongoIdSchema, parse } from "../utils/validate";

const MAX_SERIES = 20;

const ruleSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly"]),
    interval: z.number().int().min(1).max(30),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30."),
    timezone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone."),
  })
  .refine((r) => r.frequency !== "weekly" || r.weekdays.length > 0, {
    path: ["weekdays"],
    message: "Pick at least one weekday.",
  })
  .refine((r) => !ruleProblem(r), {
    message:
      "These repeat settings put the same post on back-to-back days, which Buffer does not accept.",
  });

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-20.");

const body = z.object({
  name: z.string().trim().max(80).default(""),
  text: z
    .string()
    .max(25000)
    .transform(cleanText)
    .refine((t) => t.trim().length > 0, "Write something first."),
  assets: assetsSchema,
  targets: targetsSchema,
  rule: ruleSchema,
  startDate: ymd,
  endDate: ymd.nullable().optional(),
  maxOccurrences: z.number().int().min(1).max(365).nullable().optional(),
  sourcePostId: z.string().max(64).nullable().optional(),
});

const idParams = z.object({ id: mongoIdSchema });

async function owned(userId: string, id: string) {
  const s = await RecurringSeries.findOne({ _id: id, userId });
  if (!s) throw new AppError(404, "NOT_FOUND", "Recurring post not found.");
  return s;
}

/** Catch channel problems (like Instagram without media) now, not on the first publish day. */
function checkTargets(b: z.infer<typeof body>) {
  const problems = b.targets
    .map((t) => ({ t, error: prepareTarget(t, b.assets, b.text).error }))
    .filter((x) => x.error)
    .map((x) => x.error as string);
  if (problems.length)
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      [...new Set(problems)].join(" "),
    );
}

export async function listRecurring(req: Request, res: Response) {
  const userId = req.userId!;
  // Old cancelled records are removed completely.
  await RecurringSeries.deleteMany({ userId, status: "cancelled" });
  // If we already know the account's channels (from the dashboard), drop recurring posts for gone channels.
  const known = apiCache.get<{
    organizations: {
      channels: { id: string; isDisconnected?: boolean | null }[];
    }[];
  }>(`${userId}:overview`);
  if (known)
    await purgeGoneChannels(userId, known.organizations).catch(() => 0);
  // ?watch=1 is the page checking for changes every few seconds. It only reads our own database
  // (the worker keeps that up to date), so it costs no Buffer requests.
  if (req.query.watch !== "1") {
    await reconcileUser(userId);
    await syncDueForUser(userId);
  }
  const items = await RecurringSeries.find({
    userId,
    status: { $ne: "cancelled" },
  })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ series: items.map((s) => publicSeries(s)) });
}

export async function createRecurring(req: Request, res: Response) {
  const userId = req.userId!;
  const b = parse(body, req.body);
  checkTargets(b);
  const count = await RecurringSeries.countDocuments({
    userId,
    status: { $in: ["active", "paused"] },
  });
  if (count + b.targets.length > MAX_SERIES) {
    throw new AppError(
      409,
      "LIMIT",
      `You can keep up to ${MAX_SERIES} recurring posts. Cancel some first.`,
    );
  }

  // One document per channel, so each one can be paused, edited or cancelled on its own.
  const made: string[] = [];
  for (const target of b.targets) {
    const s = await RecurringSeries.create({
      ...b,
      targets: [target],
      userId,
      nextCheckAt: new Date(),
    });
    made.push(String(s._id));
    await syncSeries(String(s._id)).catch((e) =>
      console.error(
        "Recurring sync failed:",
        e instanceof Error ? e.message : e,
      ),
    );
  }
  const fresh = await RecurringSeries.find({ _id: { $in: made }, userId });
  clearUserCache(userId);
  res.status(201).json({ series: fresh.map((s) => publicSeries(s)) });
}

export async function updateRecurring(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(idParams, req.params);
  const b = parse(body, req.body);
  checkTargets(b);
  const s = await owned(userId, id);
  if (s.status === "cancelled")
    throw new AppError(409, "CANCELLED", "This recurring post was cancelled.");
  const gone = await removeUpcoming(s);
  if (gone.removed < gone.expected) {
    await s.save();
    throw new AppError(
      502,
      "BUFFER_DELETE_FAILED",
      "Buffer would not remove the upcoming posts, so nothing was changed. Try again in a minute.",
    );
  }
  s.set({
    ...b,
    status: "active",
    nextIndex: 0,
    failures: 0,
    lastError: null,
    nextCheckAt: new Date(),
    syncLockUntil: null,
  });
  await s.save();
  await syncSeries(id);
  res.json({ series: publicSeries(await owned(userId, id)) });
}

export async function pauseRecurring(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(idParams, req.params);
  const s = await owned(userId, id);
  if (s.status !== "active")
    throw new AppError(
      409,
      "NOT_ACTIVE",
      "This recurring post is not running.",
    );
  const { removed, expected } = await removeUpcoming(s);
  if (removed < expected) {
    await s.save();
    throw new AppError(
      502,
      "BUFFER_DELETE_FAILED",
      "Buffer would not remove the upcoming posts, so it was not paused. Try again in a minute, or delete them in Buffer.",
    );
  }
  s.status = "paused";
  s.nextCheckAt = null;
  await s.save();
  res.json({ series: publicSeries(s), removed });
}

export async function resumeRecurring(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(idParams, req.params);
  const s = await owned(userId, id);
  if (s.status !== "paused")
    throw new AppError(409, "NOT_PAUSED", "This recurring post is not paused.");
  s.status = "active";
  s.failures = 0;
  s.lastError = null;
  s.nextCheckAt = new Date();
  await s.save();
  await syncSeries(id);
  res.json({ series: publicSeries(await owned(userId, id)) });
}

export async function cancelRecurring(req: Request, res: Response) {
  const userId = req.userId!;
  const { id } = parse(idParams, req.params);
  const s = await owned(userId, id);
  // Stop the worker from touching it first, then take the upcoming posts out of Buffer.
  s.status = "cancelled";
  s.nextCheckAt = null;
  await s.save();
  const { removed, expected, leftover } = await removeUpcoming(s);
  await s.deleteOne(); // the recurring post is always deleted from the database
  clearUserCache(userId);
  if (removed >= expected)
    return res.json({ ok: true, deleted: true, removed });
  const when = leftover
    .map((l) => l.dueAt.toISOString().slice(0, 16).replace("T", " ") + " UTC")
    .join(", ");
  res.json({
    ok: true,
    deleted: true,
    removed,
    warning: `The recurring post is deleted, but Buffer still holds ${leftover.length} of its upcoming post(s) (${when}). Delete them in Buffer, or they can block new posts with the same text.`,
  });
}
