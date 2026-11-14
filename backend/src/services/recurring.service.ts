import type { HydratedDocument } from "mongoose";
import {
  RecurringSeries,
  type RecurringSeriesDoc,
} from "../models/RecurringSeries.model";
import { AppError } from "../utils/errors";
import { clearUserCache } from "../utils/cache";
import {
  createPosts,
  deletePostsBatch,
  findSameTextPosts,
  postsStillExist,
} from "./bufferData.service";
import type { AssetIn, Target } from "./postMetadata.service";
import {
  compareYmd,
  formatYmd,
  localDateOf,
  parseYmd,
  zonedToUtc,
  type Rule,
} from "./recurrence";

/** How many future occurrences we keep created in Buffer at any time. */
const WINDOW = 2;
/** A time less than this far away is treated as already gone. */
const MIN_LEAD_MS = 2 * 60_000;
const KEEP_PAST = 100;
const DUPLICATE_RE = /already.*(scheduled|posted)|same thing twice/i;

type SeriesDoc = HydratedDocument<RecurringSeriesDoc>;

const ruleOf = (s: SeriesDoc): Rule => {
  const r = s.rule!;
  return {
    frequency: r.frequency as Rule["frequency"],
    interval: r.interval as number,
    weekdays: [...(r.weekdays ?? [])],
    time: r.time as string,
    timezone: r.timezone as string,
  };
};

const targetsOf = (s: SeriesDoc): Target[] =>
  s.targets.map((t) => ({
    channelId: t.channelId as string,
    service: t.service as Target["service"],
    options: (t.options ?? {}) as Target["options"],
  }));

const assetsOf = (s: SeriesDoc): AssetIn[] =>
  s.assets.map((a) => ({
    kind: a.kind as "image" | "video",
    url: a.url as string,
    ...(a.altText ? { altText: a.altText } : {}),
  }));

const isUpcoming = (o: { dueAt: Date; state: string }, now: number) =>
  o.dueAt.getTime() > now && o.state !== "skipped";

/** Post ids in Buffer that have not gone out yet. */
export function upcomingPostIds(s: SeriesDoc, now = Date.now()): string[] {
  return s.occurrences
    .filter((o) => isUpcoming(o, now))
    .flatMap((o) =>
      o.posts.map((p) => p.postId).filter((x): x is string => Boolean(x)),
    );
}

function prune(s: SeriesDoc, now: number) {
  const past = s.occurrences.filter((o) => !isUpcoming(o, now));
  const future = s.occurrences.filter((o) => isUpcoming(o, now));
  s.occurrences.splice(
    0,
    s.occurrences.length,
    ...past.slice(-KEEP_PAST),
    ...future,
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Fill {date} and {number} in the text for one occurrence. This lets each post differ, which is the
 * only way to get around Buffer refusing the same text twice in a row. Text without them is unchanged.
 */
export function renderText(
  text: string,
  n: number,
  d: { y: number; m: number; d: number },
): string {
  return text
    .replace(/\{number\}/g, String(n + 1))
    .replace(/\{date\}/g, `${d.d} ${MONTHS[d.m - 1]} ${d.y}`);
}

/** Say what Buffer already holds that looks like this post, so the person can see the real cause. */
async function explainDuplicate(
  s: SeriesDoc,
  dueAt: Date,
  message: string,
  text = s.text,
): Promise<string> {
  const when = dueAt.toISOString();
  const channelId = s.targets[0]?.channelId as string | undefined;
  const ours = new Set(
    s.occurrences.flatMap((o) => o.posts.map((p) => p.postId).filter(Boolean)),
  );
  const same = channelId
    ? await findSameTextPosts(s.userId, channelId, text)
    : [];
  if (!same.length)
    return `Skipped ${when}. Buffer said: ${message} (no post with the same text was found, so this may be Buffer's own rule).`;
  const lines = same
    .slice(0, 3)
    .map(
      (p) =>
        `${p.status} ${p.sentAt ?? p.dueAt ?? ""}${ours.has(p.id) ? " (from this recurring post)" : " (not from this recurring post)"}`,
    );
  return `Skipped ${when}. Buffer already has a post with the same text on this channel: ${lines.join("; ")}.`.slice(
    0,
    480,
  );
}

/**
 * Bring one series up to date: make sure the next WINDOW occurrences exist in Buffer.
 * Safe to call at any time; it does nothing when nothing is due.
 */
export async function syncSeries(
  id: string,
  opts: { reconcile?: boolean } = {},
): Promise<void> {
  const now = Date.now();
  // Claim the series so two workers (or a worker and a page load) never create the same post twice.
  const claimed = await RecurringSeries.findOneAndUpdate(
    {
      _id: id,
      status: "active",
      $or: [{ syncLockUntil: null }, { syncLockUntil: { $lt: new Date(now) } }],
    },
    { $set: { syncLockUntil: new Date(now + 3 * 60_000) } },
    { new: true },
  );
  if (!claimed) return;
  const s = claimed as SeriesDoc;

  try {
    // If the person deleted an upcoming post in Buffer, forget it. That time is treated as skipped
    // (they removed it on purpose), and the next occurrence is created to fill the gap.
    if (opts.reconcile) {
      const ids = upcomingPostIds(s, now);
      if (ids.length) {
        const still = new Set(await postsStillExist(s.userId, ids));
        for (const o of s.occurrences.filter((x) => isUpcoming(x, now))) {
          const kept = o.posts.filter((p) => !p.postId || still.has(p.postId));
          if (kept.length === o.posts.length) continue;
          o.posts = kept as typeof o.posts;
          if (!kept.length) o.state = "skipped";
        }
      }
    }

    const rule = ruleOf(s);
    let upcoming = s.occurrences.filter((o) => isUpcoming(o, now)).length;

    while (upcoming < WINDOW) {
      const n = s.nextIndex;
      if (s.maxOccurrences && n >= s.maxOccurrences) {
        s.status = "completed";
        break;
      }
      const local = localDateOf(rule, s.startDate, n);
      if (s.endDate && compareYmd(local, parseYmd(s.endDate)) > 0) {
        s.status = "completed";
        break;
      }
      const dueAt = zonedToUtc(local, rule.time, rule.timezone);

      if (dueAt.getTime() < now + MIN_LEAD_MS) {
        s.occurrences.push({ index: n, dueAt, state: "skipped", posts: [] });
        s.nextIndex = n + 1;
        continue;
      }

      let results;
      try {
        results = await createPosts(s.userId, {
          targets: targetsOf(s),
          text: renderText(s.text, n, local),
          mode: "customScheduled",
          dueAt: dueAt.toISOString(),
          saveToDraft: false,
          assets: assetsOf(s),
        });
      } catch (e) {
        s.failures += 1;
        s.lastError = e instanceof Error ? e.message : "Buffer request failed.";
        const rateLimited =
          e instanceof AppError && e.code === "BUFFER_RATE_LIMITED";
        const reauth =
          e instanceof AppError && e.code === "BUFFER_REAUTH_REQUIRED";
        if (reauth || s.failures >= (rateLimited ? 12 : 4)) s.status = "paused";
        s.nextCheckAt = new Date(
          Date.now() + (rateLimited ? 20 : 10 * s.failures) * 60_000,
        );
        break;
      }

      const ok = results.filter((r) => r.ok);
      if (!ok.length) {
        const message =
          results.find((r) => r.error)?.error ??
          "Buffer did not accept the post.";
        if (DUPLICATE_RE.test(message)) {
          // Buffer already has this exact post around this time. Skip the slot instead of failing the series.
          s.occurrences.push({ index: n, dueAt, state: "skipped", posts: [] });
          s.nextIndex = n + 1;
          // Look up the cause once (it costs extra Buffer requests); later skips reuse a short note.
          const why = s.skippedDuplicates.length
            ? `Buffer refused it as a duplicate: ${message}`
            : await explainDuplicate(
                s,
                dueAt,
                message,
                renderText(s.text, n, local),
              );
          s.skippedDuplicates.push({ dueAt, message: why.slice(0, 480) });
          if (s.skippedDuplicates.length > 10)
            s.skippedDuplicates.splice(0, s.skippedDuplicates.length - 10);
          s.lastError = null;
          continue;
        }
        s.failures += 1;
        s.lastError = message;
        if (s.failures >= 3) s.status = "paused";
        s.nextCheckAt = new Date(Date.now() + 10 * s.failures * 60_000);
        break;
      }
      // Remember channels that Buffer can only remind (Instagram personal profiles), so next time we ask correctly.
      for (const r of ok) {
        if (r.schedulingType !== "notification") continue;
        const t = s.targets.find((x) => x.channelId === r.channelId);
        if (
          t &&
          (t.options as { schedulingType?: string } | undefined)
            ?.schedulingType !== "notification"
        ) {
          t.options = {
            ...((t.options as object) ?? {}),
            schedulingType: "notification",
          };
          s.markModified("targets");
        }
      }
      s.failures = 0;
      s.lastError =
        ok.length < results.length
          ? (results.find((r) => !r.ok)?.error ?? "Some channels failed.")
          : null;
      s.occurrences.push({
        index: n,
        dueAt,
        state: ok.length === results.length ? "created" : "partial",
        posts: results.map((r) => ({
          channelId: r.channelId,
          postId: (r.post?.id as string | undefined) ?? null,
          error: r.error ?? null,
        })),
      });
      s.nextIndex = n + 1;
      upcoming += 1;
    }

    if (s.status === "active" && s.failures === 0) {
      const next = s.occurrences
        .filter((o) => isUpcoming(o, Date.now()))
        .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
      s.nextCheckAt = next
        ? new Date(next.dueAt.getTime() + 60_000)
        : new Date(Date.now() + 60 * 60_000);
    }
    if (s.status === "completed") s.nextCheckAt = null;
    prune(s, Date.now());
    clearUserCache(s.userId);
  } finally {
    s.syncLockUntil = null;
    await s.save();
  }
}

/**
 * Remove the not-yet-sent posts of a series from Buffer and from our record.
 * If Buffer could not delete all of them, we keep their ids so nothing is forgotten.
 */
export async function removeUpcoming(s: SeriesDoc): Promise<{
  removed: number;
  expected: number;
  leftover: { postId: string; dueAt: Date }[];
}> {
  const now = Date.now();
  const upcoming = s.occurrences.filter((o) => isUpcoming(o, now));
  const ids = upcomingPostIds(s, now);
  await deletePostsBatch(s.userId, ids).catch(() => 0);
  // Do not trust the delete answer alone. Ask Buffer which of these posts are still there.
  const still = new Set(await postsStillExist(s.userId, ids));
  const leftover = upcoming.flatMap((o) =>
    o.posts
      .filter((p) => p.postId && still.has(p.postId))
      .map((p) => ({ postId: p.postId as string, dueAt: o.dueAt })),
  );
  // Forget the posts that are gone. Keep only the ones Buffer still has.
  for (const o of upcoming)
    o.posts = o.posts.filter(
      (p) => !p.postId || still.has(p.postId),
    ) as typeof o.posts;
  // The removed occurrences were never published, so the series must make them again on resume.
  // Without this, nextIndex stays ahead and resume jumps past them.
  const removedIdx = upcoming
    .filter((o) => o.posts.length === 0)
    .map((o) => o.index);
  if (removedIdx.length) s.nextIndex = Math.min(s.nextIndex, ...removedIdx);
  const keep = s.occurrences.filter(
    (o) => !isUpcoming(o, now) || o.posts.length > 0,
  );
  s.occurrences.splice(0, s.occurrences.length, ...keep);
  clearUserCache(s.userId);
  return { removed: ids.length - still.size, expected: ids.length, leftover };
}

/** Sync every series of one user that is due. Used when a page loads, in case the worker was asleep. */
export async function syncDueForUser(userId: string): Promise<void> {
  const due = await RecurringSeries.find({
    userId,
    status: "active",
    nextCheckAt: { $lte: new Date() },
  })
    .select("_id")
    .limit(10);
  for (const d of due)
    await syncSeries(String(d._id), { reconcile: true }).catch((e) =>
      console.error(
        "Recurring sync failed:",
        e instanceof Error ? e.message : e,
      ),
    );
}

export function publicSeries(s: SeriesDoc, now = Date.now()) {
  const upcoming = s.occurrences
    .filter((o) => isUpcoming(o, now))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map((o) => ({
      index: o.index,
      dueAt: o.dueAt,
      state: o.state,
      posts: o.posts,
    }));
  const sent = s.occurrences.filter(
    (o) => !isUpcoming(o, now) && o.state !== "skipped",
  ).length;
  return {
    id: String(s._id),
    name: s.name,
    text: s.text,
    assets: s.assets,
    targets: s.targets,
    rule: ruleOf(s),
    startDate: s.startDate,
    endDate: s.endDate,
    maxOccurrences: s.maxOccurrences,
    status: s.status,
    upcoming,
    nextDueAt: upcoming[0]?.dueAt ?? null,
    publishedCount: sent,
    failures: s.failures,
    lastError: s.lastError,
    skippedDuplicates: (s.skippedDuplicates ?? []).map((x) => ({
      dueAt: x.dueAt,
      message: x.message,
    })),
    createdAt: (s as unknown as { createdAt: Date }).createdAt,
  };
}

export { formatYmd };

const lastReconcile = new Map<string, number>();

/** Check that every active series still matches what is in Buffer. At most once a minute per series. */
export async function reconcileUser(userId: string): Promise<void> {
  const list = await RecurringSeries.find({ userId, status: "active" }).select(
    "_id",
  );
  for (const d of list) {
    const key = String(d._id);
    if (Date.now() - (lastReconcile.get(key) ?? 0) < 10_000) continue;
    lastReconcile.set(key, Date.now());
    await syncSeries(key, { reconcile: true }).catch((e) =>
      console.error(
        "Recurring check failed:",
        e instanceof Error ? e.message : e,
      ),
    );
  }
}
