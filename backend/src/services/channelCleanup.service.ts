import { RecurringSeries } from "../models/RecurringSeries.model";
import { RepostLog } from "../models/RepostLog.model";
import { clearUserCache } from "../utils/cache";

type Orgs = { channels: { id: string; isDisconnected?: boolean | null }[] }[];

/**
 * When a channel is removed or disconnected in Buffer, remove what this app keeps for it.
 * Connecting the same account again gives a new channel id, so the old data would never be used.
 * `orgs` must come from a successful Buffer read. With no organizations at all we do nothing.
 */
export async function purgeGoneChannels(
  userId: string,
  orgs: Orgs,
): Promise<number> {
  if (!orgs.length) return 0;
  const live = new Set(
    orgs
      .flatMap((o) => o.channels)
      .filter((c) => !c.isDisconnected)
      .map((c) => c.id),
  );
  let removed = 0;

  const series = await RecurringSeries.find({
    userId,
    status: { $ne: "cancelled" },
  });
  for (const s of series) {
    const alive = s.targets.filter((t) => t.channelId && live.has(t.channelId));
    if (alive.length === s.targets.length) continue;
    if (!alive.length) {
      await s.deleteOne();
    } else {
      // An older recurring post that covers several channels: keep it for the channels that remain.
      s.targets.splice(0, s.targets.length, ...alive);
      s.markModified("targets");
      await s.save();
    }
    removed += 1;
  }

  const logs = await RepostLog.deleteMany({
    userId,
    channelId: { $nin: [...live] },
  });
  removed += logs.deletedCount ?? 0;

  if (removed) clearUserCache(userId);
  return removed;
}
