import type { Request, Response } from "express";
import { loadOverview } from "../services/bufferData.service";
import { getRateLimit } from "../services/rateLimit.service";
import { syncDueForUser } from "../services/recurring.service";
import { purgeGoneChannels } from "../services/channelCleanup.service";
import { apiCache } from "../utils/cache";

/**
 * GET /api/buffer/overview
 * Everything the dashboard needs: account, organizations, channels and post counts.
 * Cached for 60 seconds per user. Add ?refresh=1 to skip the cache.
 */
export async function getOverview(req: Request, res: Response) {
  const userId = req.userId!;
  // If the server was asleep, catch up any recurring posts that are due. Runs in the background.
  void syncDueForUser(userId).catch(() => undefined);
  const key = `${userId}:overview`;
  const cached =
    req.query.refresh === "1"
      ? undefined
      : apiCache.get<Awaited<ReturnType<typeof loadOverview>>>(key);
  if (cached) {
    res.json({ ...cached, rateLimit: getRateLimit(), cached: true });
    return;
  }
  const data = await loadOverview(userId);
  // Channels that were disconnected or removed in Buffer: drop what we keep for them.
  const cleanedUp = await purgeGoneChannels(userId, data.organizations).catch(
    () => 0,
  );
  apiCache.set(key, data);
  res.json({ ...data, cached: false, cleanedUp });
}
